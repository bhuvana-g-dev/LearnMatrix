"""
agents/topic_quiz_agent.py

AI fallback for the post-topic quiz (Objective 3). Only invoked by
services/topic_quiz_service.py when the Question Bank doesn't have
settings.TOPIC_QUIZ_QUESTION_COUNT active questions tagged with this
exact Skill+Topic yet — same "admin-curated first, AI fills the rest"
priority as services/youtube_service.py, not a replacement for the bank.

Reuses QuestionGenerationAgent's underlying machinery (generate_json,
GeneratedQuestion, the retry-once-on-malformed-JSON behavior) via
composition rather than subclassing — this agent's PROMPT is different
enough (single topic, fixed Easy/Medium/Hard spread, revision framing)
that inheriting run()/run_mixed() and overriding half of it would be
messier than just building its own small prompt and calling the same
generate_json() utility directly.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from models.generated_question_model import GeneratedQuestion
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_ROW_FIELDS = [
    "Question", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer", "Difficulty",
]


class TopicQuizGenerationError(AgentError):
    pass


class TopicQuizAgent(BaseAgent):
    name = "TopicQuizAgent"

    def run(self, skill: str, topic: str, count_needed: int) -> list[dict]:
        """Generates exactly count_needed MCQs for one topic, spread
        proportionally across Easy/Medium/Hard using the same ratio as
        settings.TOPIC_QUIZ_DIFFICULTY_SPREAD (3:4:3 out of 10)."""
        if count_needed <= 0:
            return []

        difficulty_counts = self._scale_spread(count_needed)
        prompt = self._build_prompt(skill, topic, difficulty_counts)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(
                    prompt,
                    gemini_api_key=settings.GEMINI_API_KEY_TOPIC_QUIZ,
                    # Optional comma-separated rotation pool, independent from
                    # assessment/chat. See config/settings.py's
                    # GEMINI_API_KEYS_POOL_TOPIC_QUIZ.
                    gemini_key_pool=settings.GEMINI_API_KEYS_POOL_TOPIC_QUIZ,
                )
                rows = self._extract_rows(raw)
                self._validate_rows(rows, count_needed)
                return [
                    GeneratedQuestion.from_gemini_row(
                        {**row, "Skill": skill, "Topic": topic}, i + 1
                    ).to_dict()
                    for i, row in enumerate(rows)
                ]
            except (GeminiClientError, TopicQuizGenerationError) as exc:
                last_error = exc
                if attempt < settings.AI_GENERATION_MAX_RETRIES:
                    time.sleep(2)
                continue

        raise TopicQuizGenerationError(
            f"Topic quiz generation for '{skill} / {topic}' failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    # ------------------------------------------------------------------

    def _scale_spread(self, count_needed: int) -> dict[str, int]:
        """Scales settings.TOPIC_QUIZ_DIFFICULTY_SPREAD (built for a full
        10-question quiz) down proportionally when the bank already
        covers part of the count — e.g. bank has 6, need 4 more."""
        base = settings.TOPIC_QUIZ_DIFFICULTY_SPREAD
        base_total = sum(base.values())
        scaled = {k: round(v * count_needed / base_total) for k, v in base.items()}

        # Rounding can drift the total off by 1-2 — nudge the largest
        # bucket to absorb the difference rather than under/over-asking.
        drift = count_needed - sum(scaled.values())
        if drift != 0:
            biggest = max(scaled, key=scaled.get)
            scaled[biggest] = max(0, scaled[biggest] + drift)
        return {k: v for k, v in scaled.items() if v > 0}

    def _build_prompt(self, skill: str, topic: str, difficulty_counts: dict[str, int]) -> str:
        spread_lines = "\n".join(f"- {v} {k} question(s)" for k, v in difficulty_counts.items())
        total = sum(difficulty_counts.values())
        return f"""Generate exactly {total} multiple-choice questions testing a student's
understanding of the topic "{topic}" within the skill "{skill}", for a
short post-lesson comprehension quiz (NOT a from-scratch diagnostic —
assume the student just studied this specific topic).

Difficulty spread:
{spread_lines}

Return ONLY a JSON array (no markdown fences, no prose) of exactly {total}
objects, each shaped like:
{{
  "Question": "...",
  "OptionA": "...", "OptionB": "...", "OptionC": "...", "OptionD": "...",
  "CorrectAnswer": "OptionA" | "OptionB" | "OptionC" | "OptionD",
  "Difficulty": "Easy" | "Medium" | "Hard",
  "Explanation": "one sentence"
}}"""

    def _extract_rows(self, raw) -> list[dict]:
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict) and isinstance(raw.get("questions"), list):
            return raw["questions"]
        raise TopicQuizGenerationError("Gemini response was not a JSON array of questions.")

    def _validate_rows(self, rows: list[dict], expected_count: int) -> None:
        if len(rows) != expected_count:
            raise TopicQuizGenerationError(
                f"Expected {expected_count} questions, got {len(rows)}."
            )
        for row in rows:
            missing = [f for f in REQUIRED_ROW_FIELDS if not str(row.get(f, "")).strip()]
            if missing:
                raise TopicQuizGenerationError(f"Question missing required field(s): {missing}")
