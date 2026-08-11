"""
agents/lesson_planner_agent.py

Generates the Lessons layer's actual "breakdown" — given a topic (and,
when available, its Description/Difficulty/EstimatedMinutes from
data/skill_syllabus_seed.py), returns settings.LESSON_MIN_COUNT to
LESSON_MAX_COUNT ordered {Title, Summary} lessons that together cover
the topic's stated scope.

Deliberately produces ONLY the outline (title + one-sentence summary
per lesson) — NOT each lesson's actual theory content. That's a
one-time, cheap call whose result is cached forever (see
services/lesson_repository.py). Each lesson's real content (theory +
video + resources) is generated separately, on demand, by the EXISTING
notes/resource pipeline the first time a student actually opens that
lesson — see services/lesson_service.py for why splitting these two
concerns keeps this agent fast and cheap regardless of how many lessons
a topic ends up with.
"""

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError


class LessonPlanningError(AgentError):
    pass


class LessonPlannerAgent(BaseAgent):
    name = "LessonPlannerAgent"

    def run(
        self, skill: str, topic: str,
        description: str = "", difficulty: str = "", estimated_minutes: int = 0,
    ) -> list[dict]:
        prompt = self._build_prompt(skill, topic, description, difficulty, estimated_minutes)

        try:
            raw = generate_json(prompt)
            rows = self._extract_rows(raw)
            self._validate_rows(rows)
        except (GeminiClientError, LessonPlanningError) as exc:
            raise LessonPlanningError(
                f"Lesson planning for '{skill} / {topic}' failed: {exc}"
            ) from exc

        return [
            {"Order": i + 1, "Title": row["Title"].strip(), "Summary": row["Summary"].strip()}
            for i, row in enumerate(rows)
        ]

    # ------------------------------------------------------------------

    def _build_prompt(self, skill, topic, description, difficulty, estimated_minutes) -> str:
        context_lines = []
        if description:
            context_lines.append(f"Topic scope: {description}")
        if difficulty:
            context_lines.append(f"Target difficulty: {difficulty}")
        if estimated_minutes:
            context_lines.append(f"Total estimated study time for the whole topic: {estimated_minutes} minutes")
        context = "\n".join(context_lines) or "No further context provided — use your best judgement for scope."

        return f"""Break the topic "{topic}" (part of the skill "{skill}") into a small
number of bite-sized LESSONS a student would study one after another,
each covering one coherent sub-idea — NOT the lesson content itself,
just an outline.

{context}

Rules:
- Between {settings.LESSON_MIN_COUNT} and {settings.LESSON_MAX_COUNT} lessons, in the order a
  student should study them.
- Each lesson title is short (a few words), specific, and non-overlapping
  with the others.
- Each summary is exactly one sentence describing what that lesson covers.

Return ONLY a JSON array (no markdown fences, no prose) shaped like:
[
  {{"Title": "...", "Summary": "..."}},
  {{"Title": "...", "Summary": "..."}}
]"""

    def _extract_rows(self, raw) -> list[dict]:
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict) and isinstance(raw.get("lessons"), list):
            return raw["lessons"]
        raise LessonPlanningError("Gemini response was not a JSON array of lessons.")

    def _validate_rows(self, rows: list[dict]) -> None:
        if not (settings.LESSON_MIN_COUNT <= len(rows) <= settings.LESSON_MAX_COUNT):
            raise LessonPlanningError(
                f"Expected {settings.LESSON_MIN_COUNT}-{settings.LESSON_MAX_COUNT} lessons, got {len(rows)}."
            )
        for row in rows:
            if not str(row.get("Title", "")).strip() or not str(row.get("Summary", "")).strip():
                raise LessonPlanningError(f"Lesson row missing Title or Summary: {row}")
