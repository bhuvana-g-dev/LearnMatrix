"""
agents/notes_generation_agent.py

Notes Generation Agent — new agent for the Learning System
(LEARNING_SYSTEM_ARCHITECTURE.md), same design pattern as
agents/question_generation_agent.py: generates ORIGINAL content via
Gemini/Groq rather than trying to recall/link to real external
resources.

WHY THIS EXISTS (not a resource-link generator): asking an LLM to
produce a real URL to a specific video/article is a well-known
hallucination trap — it will confidently return links that look real
but don't work or don't exist, because the model isn't browsing the
internet, it's guessing what a plausible link would look like. Asking
it to WRITE original explanatory notes has no such risk — same reason
question generation is reliable. Real external links (official docs,
GitHub) are handled separately by services/resource_repository.py, a
small manually-curated table, NOT generated here.

Output is cached by services/notes_repository.py per
(skill, topic, focusBand) — generated once, reused by every student at
that level, never regenerated per-request. See
services/learning_content_service.py for the cache-check-then-generate
orchestration.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["title", "summary", "sections", "keyTakeaways"]

FOCUS_BAND_GUIDANCE = {
    "fundamentals": (
        "Explain from absolute scratch, as if the reader has never seen this "
        "topic before. Use a simple real-world analogy. Avoid jargon; define "
        "any term you must use. Keep code examples minimal and heavily commented."
    ),
    "application": (
        "Assume the reader knows the basic definition already. Focus on HOW to "
        "use this in practice: a worked example, common patterns, and one "
        "typical mistake to watch for."
    ),
    "advanced": (
        "Assume solid working knowledge already. Focus on edge cases, "
        "performance/design tradeoffs, and how this interacts with related "
        "concepts. Skip basic definitions entirely."
    ),
    "polish": (
        "Write a compact reference summary only — key facts, gotchas, and a "
        "quick-recall checklist. No introductory explanation at all."
    ),
}


class NotesGenerationError(AgentError):
    pass


class NotesGenerationAgent(BaseAgent):
    name = "NotesGenerationAgent"

    def run(self, skill: str, topic: str, focus_band: str) -> dict:
        if focus_band not in FOCUS_BAND_GUIDANCE:
            raise NotesGenerationError(
                f"focus_band must be one of {list(FOCUS_BAND_GUIDANCE)}, got '{focus_band}'."
            )

        prompt = self._build_prompt(skill, topic, focus_band)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt)
                self._validate(raw)
                return raw
            except (GeminiClientError, NotesGenerationError) as exc:
                last_error = exc
                is_last_attempt = attempt == settings.AI_GENERATION_MAX_RETRIES
                if not is_last_attempt:
                    time.sleep(2)
                continue

        raise NotesGenerationError(
            f"Notes generation for '{skill} / {topic}' ({focus_band}) failed "
            f"after {settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(self, skill: str, topic: str, focus_band: str) -> str:
        guidance = FOCUS_BAND_GUIDANCE[focus_band]
        return f"""You are writing study notes for a computer science
learning platform, on the topic "{topic}" (part of the skill "{skill}").

Audience level: {focus_band}.
{guidance}

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape:
{{
  "title": "<short, specific title for these notes>",
  "summary": "<1-2 sentence overview of what this topic covers>",
  "sections": [
    {{"heading": "<section heading>", "content": "<2-4 sentences, plain text, no markdown>"}}
  ],
  "codeExample": "<a short, runnable code snippet illustrating the concept, or empty string if not applicable to this topic>",
  "keyTakeaways": ["<short bullet point>", "<short bullet point>", "<short bullet point>"]
}}

Include 2-4 sections. Keep total content focused — this should take
{"2-3" if focus_band == "polish" else "4-6"} minutes to read."""

    def _validate(self, raw: dict) -> None:
        if not isinstance(raw, dict):
            raise NotesGenerationError("Gemini response was not a JSON object.")
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise NotesGenerationError(f"Response missing required field(s): {missing}")
        if not isinstance(raw["sections"], list) or len(raw["sections"]) == 0:
            raise NotesGenerationError("'sections' must be a non-empty list.")
        for i, section in enumerate(raw["sections"]):
            if not isinstance(section, dict) or "heading" not in section or "content" not in section:
                raise NotesGenerationError(f"Section {i + 1} missing 'heading' or 'content'.")
        if not isinstance(raw["keyTakeaways"], list) or len(raw["keyTakeaways"]) == 0:
            raise NotesGenerationError("'keyTakeaways' must be a non-empty list.")
