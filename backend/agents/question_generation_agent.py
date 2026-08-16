"""
agents/question_generation_agent.py

Agent #2 in the AI Agent architecture (see ARCHITECTURE.md).

Responsibility: given topics, difficulty, count, and a learning objective,
generate that many structured questions via Gemini. Nothing here talks
to Firestore and nothing here validates against the Question Bank rules
beyond basic shape — that's the Quality Validation Agent's job (Agent #3),
kept separate on purpose so each agent stays single-responsibility and
independently testable.

This agent DOES do one lightweight check of its own: it re-asks Gemini
once if the response isn't valid JSON or is missing required fields,
because a malformed API response is a generation failure, not a quality
failure — retrying belongs here, not in the validator.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from models.generated_question_model import GeneratedQuestion
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_MCQ_FIELDS = [
    "Skill",
    "Difficulty",
    "QuestionType",
    "Question",
    "OptionA",
    "OptionB",
    "OptionC",
    "OptionD",
    "CorrectAnswer",
]

# FillBlank/CodeCompletion rows don't use OptionA-D at all — see
# models/generated_question_model.py and services/answer_equivalence_service.py.
REQUIRED_OPEN_ENDED_FIELDS = ["Skill", "Difficulty", "QuestionType", "Question", "CorrectAnswer"]

# Kept as the old name too since some callers/tests may still import it —
# identical to REQUIRED_MCQ_FIELDS.
REQUIRED_ROW_FIELDS = REQUIRED_MCQ_FIELDS


class QuestionGenerationError(AgentError):
    pass


class QuestionGenerationAgent(BaseAgent):
    name = "QuestionGenerationAgent"

    def run(
        self,
        topics: list[str],
        difficulty: str,
        count: int,
        skill: str,
        learning_objective: str = "",
    ) -> list[dict]:
        """
        Returns a list of GeneratedQuestion dicts (see
        models/generated_question_model.py). Never writes to Firestore —
        the caller (Assessment Builder Agent, or the route in a PoC
        context) decides what happens to the output.
        """
        self._validate_inputs(topics, difficulty, count)

        prompt = self._build_prompt(topics, difficulty, count, skill, learning_objective)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, gemini_api_key=settings.GEMINI_API_KEY_ASSESSMENT)
                rows = self._extract_rows(raw)
                self._validate_rows(rows, count)
                return [
                    GeneratedQuestion.from_gemini_row(row, i + 1).to_dict()
                    for i, row in enumerate(rows)
                ]
            except (GeminiClientError, QuestionGenerationError) as exc:
                last_error = exc
                is_last_attempt = attempt == settings.AI_GENERATION_MAX_RETRIES
                if not is_last_attempt:
                    # Transient overload (503) usually clears within a
                    # couple seconds — retrying instantly tends to hit the
                    # exact same busy moment again. A short fixed delay
                    # (not exponential — we only ever retry once or twice
                    # here, so backoff math isn't worth the complexity)
                    # meaningfully raises the odds the retry succeeds.
                    time.sleep(2)
                continue

        raise QuestionGenerationError(
            f"Question generation failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def run_mixed(
        self,
        topics: list[str],
        skill: str,
        difficulty_counts: dict[str, int],
        learning_objective: str = "",
    ) -> list[dict]:
        """
        Like run(), but generates a fixed count PER difficulty level in a
        single call — e.g. {"Easy": 2, "Medium": 2, "Hard": 2} — instead
        of one uniform-difficulty batch.

        Kept for callers that want a genuinely small, single-call mixed
        batch (total <= ~6-8). For the diagnostic assessment's larger
        15-question/skill plan, use run_chunked() below instead — one
        big 15-question call is exactly the failure mode that motivated
        chunking in the first place.
        """
        difficulty_counts = {k: v for k, v in difficulty_counts.items() if v > 0}
        total = sum(difficulty_counts.values())
        self._validate_mixed_inputs(topics, difficulty_counts, total)

        prompt = self._build_prompt_mixed(topics, skill, difficulty_counts, learning_objective)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, gemini_api_key=settings.GEMINI_API_KEY_ASSESSMENT)
                rows = self._extract_rows(raw)
                self._validate_rows(rows, total)
                self._validate_difficulty_distribution(rows, difficulty_counts)
                return [
                    GeneratedQuestion.from_gemini_row(row, i + 1).to_dict()
                    for i, row in enumerate(rows)
                ]
            except (GeminiClientError, QuestionGenerationError) as exc:
                last_error = exc
                is_last_attempt = attempt == settings.AI_GENERATION_MAX_RETRIES
                if not is_last_attempt:
                    time.sleep(2)
                continue

        raise QuestionGenerationError(
            f"Mixed-difficulty generation for skill '{skill}' failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def run_chunked(
        self,
        topics: list[str],
        skill: str,
        difficulty_counts: dict[str, int],
        open_ended_counts: dict[str, int] | None = None,
        open_ended_type: str = "FillBlank",
        learning_objective: str = "",
    ) -> list[dict]:
        """
        Like run_mixed(), but splits the request into ONE Gemini call PER
        DIFFICULTY LEVEL instead of one call for the whole skill — e.g. a
        15-question skill (5 Easy/5 Medium/5 Hard) becomes 3 calls of 5
        questions each, the same size as the old, already-reliable
        6-question single call. This is the fix for "asking for 15 in one
        shot is too fragile, and one skill failing aborts the whole
        diagnostic assessment" — see services/assessment_planner.py's
        module docstring for the full reasoning.

        open_ended_counts (per difficulty) of each chunk's questions are
        generated as open_ended_type ("FillBlank" or "CodeCompletion")
        instead of MCQ — see services/assessment_planner.is_programming_language_skill
        for how open_ended_type gets decided per skill.

        Chunks run sequentially with a settings.AI_CHUNK_DELAY_SECONDS gap
        between them, to avoid bursting a free-tier requests-per-minute
        limit when services/ai_assessment_service.generate_diagnostic_assessment
        queues several skills' worth of these calls back-to-back.

        A chunk that fails after its own retries raises immediately — but
        because each chunk is now much smaller than the old single
        15-question call, failures should be rarer, and only that one
        difficulty's chunk (5 questions) needs retrying, not the whole
        15-question skill.
        """
        open_ended_counts = open_ended_counts or {}
        difficulty_counts = {k: v for k, v in difficulty_counts.items() if v > 0}
        if not difficulty_counts:
            raise QuestionGenerationError("difficulty_counts must have at least one difficulty with count > 0.")

        difficulties = list(difficulty_counts.keys())
        all_rows: list[dict] = []

        for idx, difficulty in enumerate(difficulties):
            open_count = min(open_ended_counts.get(difficulty, 0), difficulty_counts[difficulty])
            mcq_count = difficulty_counts[difficulty] - open_count
            chunk_total = mcq_count + open_count
            if chunk_total <= 0:
                continue

            prompt = self._build_prompt_chunk(
                topics=topics,
                skill=skill,
                difficulty=difficulty,
                mcq_count=mcq_count,
                open_count=open_count,
                open_ended_type=open_ended_type,
                learning_objective=learning_objective,
            )

            rows = self._generate_chunk_with_retries(
                prompt=prompt,
                skill=skill,
                difficulty=difficulty,
                mcq_count=mcq_count,
                open_count=open_count,
                open_ended_type=open_ended_type,
            )
            all_rows.extend(rows)

            is_last_chunk = idx == len(difficulties) - 1
            if not is_last_chunk:
                time.sleep(settings.AI_CHUNK_DELAY_SECONDS)

        return [
            GeneratedQuestion.from_gemini_row(row, i + 1).to_dict()
            for i, row in enumerate(all_rows)
        ]

    def _generate_chunk_with_retries(
        self, prompt: str, skill: str, difficulty: str, mcq_count: int, open_count: int, open_ended_type: str,
    ) -> list[dict]:
        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, gemini_api_key=settings.GEMINI_API_KEY_ASSESSMENT)
                rows = self._extract_rows(raw)
                self._validate_chunk_rows(rows, difficulty, mcq_count, open_count, open_ended_type)
                return rows
            except (GeminiClientError, QuestionGenerationError) as exc:
                last_error = exc
                is_last_attempt = attempt == settings.AI_GENERATION_MAX_RETRIES
                if not is_last_attempt:
                    time.sleep(2)
                continue

        raise QuestionGenerationError(
            f"Chunked generation for skill '{skill}' ({difficulty}, "
            f"{mcq_count} MCQ + {open_count} {open_ended_type}) failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    # ------------------------------------------------------------------

    def _validate_inputs(self, topics: list[str], difficulty: str, count: int) -> None:
        if not topics:
            raise QuestionGenerationError("At least one topic is required.")
        if difficulty not in settings.VALID_DIFFICULTIES:
            raise QuestionGenerationError(
                f"Difficulty must be one of {settings.VALID_DIFFICULTIES}, got '{difficulty}'."
            )
        if not (1 <= count <= settings.AI_MAX_QUESTIONS_PER_REQUEST):
            raise QuestionGenerationError(
                f"count must be between 1 and {settings.AI_MAX_QUESTIONS_PER_REQUEST}, got {count}."
            )

    def _build_prompt(
        self,
        topics: list[str],
        difficulty: str,
        count: int,
        skill: str,
        learning_objective: str,
    ) -> str:
        topics_str = ", ".join(topics)
        objective_line = (
            f"Learning objective: {learning_objective}\n" if learning_objective else ""
        )
        return f"""You are an expert technical assessment writer for a computer
science learning platform. Generate exactly {count} multiple-choice
questions for the skill "{skill}", covering these topics: {topics_str}.
Difficulty: {difficulty}.
{objective_line}
Rules:
- Each question has exactly 4 options (OptionA-OptionD), only one correct.
- CorrectAnswer must be exactly one of "OptionA", "OptionB", "OptionC", "OptionD".
- No duplicate options within a question.
- Questions must be technically accurate and unambiguous.
- Vary which topic (from the list) each question targets.

Respond with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[
  {{
    "Skill": "{skill}",
    "Topic": "<one topic from the list above>",
    "Difficulty": "{difficulty}",
    "QuestionType": "MCQ",
    "Question": "<question text>",
    "OptionA": "<option>",
    "OptionB": "<option>",
    "OptionC": "<option>",
    "OptionD": "<option>",
    "CorrectAnswer": "OptionA",
    "Explanation": "<1-2 sentence explanation of the correct answer>"
  }}
]"""

    def _validate_mixed_inputs(
        self, topics: list[str], difficulty_counts: dict[str, int], total: int
    ) -> None:
        if not topics:
            raise QuestionGenerationError("At least one topic is required.")
        if not difficulty_counts:
            raise QuestionGenerationError(
                "difficulty_counts must have at least one difficulty with count > 0."
            )
        invalid = [d for d in difficulty_counts if d not in settings.VALID_DIFFICULTIES]
        if invalid:
            raise QuestionGenerationError(
                f"Invalid difficulty key(s) {invalid}; must be one of {settings.VALID_DIFFICULTIES}."
            )
        if not (1 <= total <= settings.AI_MAX_QUESTIONS_PER_REQUEST):
            raise QuestionGenerationError(
                f"Total questions per skill must be between 1 and "
                f"{settings.AI_MAX_QUESTIONS_PER_REQUEST}, got {total}."
            )

    def _build_prompt_mixed(
        self,
        topics: list[str],
        skill: str,
        difficulty_counts: dict[str, int],
        learning_objective: str,
    ) -> str:
        topics_str = ", ".join(topics)
        objective_line = (
            f"Learning objective: {learning_objective}\n" if learning_objective else ""
        )
        breakdown_lines = "\n".join(
            f"- {count} question(s) at \"{level}\" difficulty" for level, count in difficulty_counts.items()
        )
        total = sum(difficulty_counts.values())

        return f"""You are an expert technical assessment writer building a
DIAGNOSTIC assessment for the skill "{skill}" (topics: {topics_str}).
This is not a generic quiz — the goal is to measure exactly how deep the
student's knowledge goes, from fundamentals to advanced usage, so their
skill level can be classified afterward.

Generate exactly {total} multiple-choice questions, split like this:
{breakdown_lines}
{objective_line}
Difficulty guidance:
- "Easy" = definitions, basic syntax, "what does X do" recognition.
- "Medium" = predict-the-output, apply a concept to a small code snippet,
  spot the bug.
- "Hard" = edge cases, combining multiple concepts, why-questions,
  performance/design tradeoffs.

Rules:
- Each question has exactly 4 options (OptionA-OptionD), only one correct.
- CorrectAnswer must be exactly one of "OptionA", "OptionB", "OptionC", "OptionD".
- No duplicate options within a question.
- Questions must be technically accurate and unambiguous.
- The "Difficulty" field of each question must exactly match one of the
  levels requested above — this is critical, it's used to score the
  student's depth of knowledge, not just overall correctness.

Respond with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[
  {{
    "Skill": "{skill}",
    "Topic": "<one topic from the list above>",
    "Difficulty": "Easy",
    "QuestionType": "MCQ",
    "Question": "<question text>",
    "OptionA": "<option>",
    "OptionB": "<option>",
    "OptionC": "<option>",
    "OptionD": "<option>",
    "CorrectAnswer": "OptionA",
    "Explanation": "<1-2 sentence explanation of the correct answer>"
  }}
]"""

    def _build_prompt_chunk(
        self,
        topics: list[str],
        skill: str,
        difficulty: str,
        mcq_count: int,
        open_count: int,
        open_ended_type: str,
        learning_objective: str,
    ) -> str:
        """
        ONE difficulty level per call (see run_chunked's docstring for
        why) — mcq_count MCQ questions plus open_count typed-answer
        questions of open_ended_type, all at `difficulty`, in one JSON
        array response.
        """
        topics_str = ", ".join(topics)
        objective_line = (
            f"Learning objective: {learning_objective}\n" if learning_objective else ""
        )
        total = mcq_count + open_count

        mcq_example = f"""  {{
    "Skill": "{skill}",
    "Topic": "<one topic from the list above>",
    "Difficulty": "{difficulty}",
    "QuestionType": "MCQ",
    "Question": "<question text>",
    "OptionA": "<option>",
    "OptionB": "<option>",
    "OptionC": "<option>",
    "OptionD": "<option>",
    "CorrectAnswer": "OptionA",
    "Explanation": "<1-2 sentence explanation of the correct answer>"
  }}"""

        if open_ended_type == "CodeCompletion":
            open_instructions = (
                f'- {open_count} question(s) must be QuestionType "CodeCompletion": '
                "a short, realistic code snippet with exactly ONE blank marked as "
                "______ (six underscores) that the student types code into. "
                "CorrectAnswer holds the exact code/expression that belongs in the "
                "blank (one line, not a full solution). OptionA-OptionD are unused "
                'for this type — set them all to "".'
            )
            open_example = f"""  {{
    "Skill": "{skill}",
    "Topic": "<one topic from the list above>",
    "Difficulty": "{difficulty}",
    "QuestionType": "CodeCompletion",
    "Question": "<code snippet with a ______ blank>",
    "OptionA": "",
    "OptionB": "",
    "OptionC": "",
    "OptionD": "",
    "CorrectAnswer": "<exact code that fills the blank>",
    "Explanation": "<1-2 sentence explanation>"
  }}"""
        else:
            open_instructions = (
                f'- {open_count} question(s) must be QuestionType "FillBlank": '
                "a sentence or definition with exactly ONE blank marked as "
                "______ (six underscores) that the student types a short answer "
                "into. CorrectAnswer holds the expected answer (a word or short "
                'phrase). OptionA-OptionD are unused for this type — set them all to "".'
            )
            open_example = f"""  {{
    "Skill": "{skill}",
    "Topic": "<one topic from the list above>",
    "Difficulty": "{difficulty}",
    "QuestionType": "FillBlank",
    "Question": "<sentence or definition with a ______ blank>",
    "OptionA": "",
    "OptionB": "",
    "OptionC": "",
    "OptionD": "",
    "CorrectAnswer": "<expected short answer>",
    "Explanation": "<1-2 sentence explanation>"
  }}"""

        type_rules = (
            f"- {mcq_count} question(s) must be QuestionType \"MCQ\" (4 options, "
            "OptionA-OptionD, exactly one correct, CorrectAnswer is the option key).\n"
            + (open_instructions + "\n" if open_count > 0 else "")
        )
        examples = mcq_example if open_count == 0 else f"{mcq_example},\n{open_example}"

        return f"""You are an expert technical assessment writer building a
DIAGNOSTIC assessment for the skill "{skill}" (topics: {topics_str}).
This is not a generic quiz — the goal is to measure exactly how deep the
student's knowledge goes, from fundamentals to advanced usage, so their
skill level can be classified afterward.

Generate exactly {total} questions, ALL at "{difficulty}" difficulty:
{type_rules}{objective_line}
Difficulty guidance for "{difficulty}":
- "Easy" = definitions, basic syntax, "what does X do" recognition.
- "Medium" = predict-the-output, apply a concept to a small code snippet,
  spot the bug.
- "Hard" = edge cases, combining multiple concepts, why-questions,
  performance/design tradeoffs.

Rules:
- No duplicate options within an MCQ question.
- Questions must be technically accurate and unambiguous.
- Every question's "Difficulty" field must be exactly "{difficulty}".
- Vary which topic (from the list) each question targets.

Respond with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[
{examples}
]"""

    def _validate_difficulty_distribution(
        self, rows: list[dict], expected_counts: dict[str, int]
    ) -> None:
        """
        Beyond the generic row validation in _validate_rows(), a mixed
        request additionally needs the ACTUAL difficulty split to match
        what was asked for — the Evaluation Agent's classification is
        only meaningful if there really are the requested counts per
        level, not e.g. all of them mislabeled into one band.
        """
        actual_counts: dict[str, int] = {}
        for row in rows:
            level = row.get("Difficulty")
            actual_counts[level] = actual_counts.get(level, 0) + 1

        if actual_counts != expected_counts:
            raise QuestionGenerationError(
                f"Difficulty distribution mismatch: expected {expected_counts}, "
                f"got {actual_counts}."
            )

    def _extract_rows(self, raw: dict | list) -> list[dict]:
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict):
            for key in ("questions", "data", "results"):
                if isinstance(raw.get(key), list):
                    return raw[key]
        raise QuestionGenerationError(
            "Gemini response was not a JSON array of questions."
        )

    def _validate_row_shape(self, row: dict, index: int) -> None:
        """Type-aware version of the old flat REQUIRED_ROW_FIELDS check —
        MCQ rows need real options; FillBlank/CodeCompletion rows don't."""
        q_type = str(row.get("QuestionType", "MCQ")).strip() or "MCQ"
        if q_type not in settings.VALID_QUESTION_TYPES:
            raise QuestionGenerationError(f"Row {index + 1} has invalid QuestionType '{q_type}'.")

        required = REQUIRED_MCQ_FIELDS if q_type == "MCQ" else REQUIRED_OPEN_ENDED_FIELDS
        missing = [f for f in required if not str(row.get(f, "")).strip()]
        if missing:
            raise QuestionGenerationError(
                f"Row {index + 1} missing required field(s): {missing}"
            )

        if q_type == "MCQ":
            options = {row["OptionA"], row["OptionB"], row["OptionC"], row["OptionD"]}
            if len(options) < 4:
                raise QuestionGenerationError(f"Row {index + 1} has duplicate options.")
            if row["CorrectAnswer"] not in ("OptionA", "OptionB", "OptionC", "OptionD"):
                raise QuestionGenerationError(
                    f"Row {index + 1} CorrectAnswer must be OptionA-D, got '{row['CorrectAnswer']}'."
                )

    def _validate_rows(self, rows: list[dict], expected_count: int) -> None:
        if not isinstance(rows, list) or len(rows) == 0:
            raise QuestionGenerationError("Gemini returned zero questions.")

        for i, row in enumerate(rows):
            self._validate_row_shape(row, i)

    def _validate_chunk_rows(
        self, rows: list[dict], difficulty: str, mcq_count: int, open_count: int, open_ended_type: str,
    ) -> None:
        """run_chunked's per-difficulty validation: right total count,
        every row's Difficulty matches this chunk's difficulty, and the
        MCQ-vs-open-ended split matches what was actually asked for."""
        expected_total = mcq_count + open_count
        if not isinstance(rows, list) or len(rows) != expected_total:
            raise QuestionGenerationError(
                f"Expected {expected_total} question(s) for {difficulty}, got "
                f"{len(rows) if isinstance(rows, list) else 'invalid response'}."
            )

        for i, row in enumerate(rows):
            self._validate_row_shape(row, i)
            if row.get("Difficulty") != difficulty:
                raise QuestionGenerationError(
                    f"Row {i + 1} has Difficulty '{row.get('Difficulty')}', expected '{difficulty}'."
                )

        actual_mcq = sum(1 for r in rows if r.get("QuestionType", "MCQ") == "MCQ")
        actual_open = sum(1 for r in rows if r.get("QuestionType") == open_ended_type)
        if actual_mcq != mcq_count or actual_open != open_count:
            raise QuestionGenerationError(
                f"Expected {mcq_count} MCQ + {open_count} {open_ended_type} for {difficulty}, "
                f"got {actual_mcq} MCQ + {actual_open} {open_ended_type}."
            )
