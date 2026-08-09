"""
agents/question_generation_agent.py

Agent #2 in the AI Agent architecture (see ARCHITECTURE.md).

Responsibility: given topics, difficulty, count, and a learning objective,
generate that many structured MCQ questions via Gemini. Nothing here talks
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

REQUIRED_ROW_FIELDS = [
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

        This is what a diagnostic/skill-wise assessment needs: each skill
        gets a real, deliberate spread across difficulty levels so the
        Evaluation Agent (services/evaluation_service.py) has enough
        signal to classify the student's actual level per skill, not
        just an overall score.

        Kept as ONE call per skill (not one call per skill+difficulty)
        specifically to limit API calls — 5 skills = 5 calls total, not
        15. See services/assessment_planner.py for how skills are turned
        into difficulty_counts dicts.
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

    def _validate_difficulty_distribution(
        self, rows: list[dict], expected_counts: dict[str, int]
    ) -> None:
        """
        Beyond the generic row validation in _validate_rows(), a mixed
        request additionally needs the ACTUAL difficulty split to match
        what was asked for — the Evaluation Agent's classification is
        only meaningful if there really are 2 Easy / 2 Medium / 2 Hard
        questions, not e.g. 6 Easy ones mislabeled.
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

    def _validate_rows(self, rows: list[dict], expected_count: int) -> None:
        if not isinstance(rows, list) or len(rows) == 0:
            raise QuestionGenerationError("Gemini returned zero questions.")

        for i, row in enumerate(rows):
            missing = [f for f in REQUIRED_ROW_FIELDS if not str(row.get(f, "")).strip()]
            if missing:
                raise QuestionGenerationError(
                    f"Row {i + 1} missing required field(s): {missing}"
                )

            options = {row["OptionA"], row["OptionB"], row["OptionC"], row["OptionD"]}
            if len(options) < 4:
                raise QuestionGenerationError(f"Row {i + 1} has duplicate options.")

            if row["CorrectAnswer"] not in ("OptionA", "OptionB", "OptionC", "OptionD"):
                raise QuestionGenerationError(
                    f"Row {i + 1} CorrectAnswer must be OptionA-D, got '{row['CorrectAnswer']}'."
                )
