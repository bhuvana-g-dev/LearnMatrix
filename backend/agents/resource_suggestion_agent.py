"""
agents/resource_suggestion_agent.py

Resource Suggestion Agent — the "AI suggests, human verifies" agent
requested directly by the team. Given a skill (optionally scoped to a
topic), asks Gemini/Groq to suggest candidate learning resources
(videos, docs, GitHub repos).

CRITICAL, LOAD-BEARING CAVEAT: unlike agents/question_generation_agent.py
and agents/notes_generation_agent.py, this agent asks the model to name
REAL external resources — titles, platforms, and URLs it has seen during
training. This has a real, well-documented failure mode: the model can
confidently return a URL that looks completely plausible but doesn't
exist or doesn't point to what it claims. This is NOT a bug to fix in
the prompt — it's an inherent limitation of asking a language model to
recall a specific fact (a URL) rather than generate original content.

THIS IS WHY EVERYTHING THIS AGENT PRODUCES IS SAVED WITH status="pending"
(services/resource_repository.py) and is NEVER shown to a student until
a human explicitly opens each link and marks it "verified". The agent's
job is to save an admin from starting a resource search from a blank
page — not to be trusted unsupervised.

Future upgrade path (not built here): replace the "ask the LLM to name
a URL" step with a real search API call (e.g. YouTube Data API) so every
suggestion is guaranteed to be a real, existing resource — the admin
would then only be judging QUALITY, not whether the link is real at
all. The rest of this pipeline (pending -> review -> verified) doesn't
need to change for that upgrade; only this one function's internals would.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["title", "url", "type", "platform"]
VALID_TYPES = ["video", "documentation", "github"]


class ResourceSuggestionError(AgentError):
    pass


class ResourceSuggestionAgent(BaseAgent):
    name = "ResourceSuggestionAgent"

    def run(self, skill: str, topic: str, count: int = 5) -> list[dict]:
        if not (1 <= count <= 10):
            raise ResourceSuggestionError("count must be between 1 and 10.")

        prompt = self._build_prompt(skill, topic, count)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt)
                rows = self._extract_rows(raw)
                self._validate_rows(rows)
                return rows
            except (GeminiClientError, ResourceSuggestionError) as exc:
                last_error = exc
                is_last_attempt = attempt == settings.AI_GENERATION_MAX_RETRIES
                if not is_last_attempt:
                    time.sleep(2)
                continue

        raise ResourceSuggestionError(
            f"Resource suggestion for '{skill} / {topic}' failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(self, skill: str, topic: str, count: int) -> str:
        return f"""Suggest {count} well-known, genuinely popular learning
resources for the topic "{topic}" (part of the skill "{skill}") —
things a working developer would actually recognize by name: official
documentation, widely-used GitHub repositories, or well-known YouTube
channels/playlists on this exact topic.

Only suggest resources you are highly confident actually exist under
that exact name and URL. If you are not confident a specific URL is
correct, suggest the resource's official homepage or channel URL
instead of guessing a deep link.

Respond with ONLY a JSON array, no prose, no markdown fences, in this
exact shape:
[
  {{
    "title": "<resource name>",
    "url": "<url>",
    "type": "video" | "documentation" | "github",
    "platform": "<e.g. YouTube, MDN, official docs, GitHub>"
  }}
]"""

    def _extract_rows(self, raw) -> list[dict]:
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict):
            for key in ("resources", "data", "results"):
                if isinstance(raw.get(key), list):
                    return raw[key]
        raise ResourceSuggestionError("Response was not a JSON array of resources.")

    def _validate_rows(self, rows: list[dict]) -> None:
        if not rows:
            raise ResourceSuggestionError("No resources returned.")
        for i, row in enumerate(rows):
            missing = [f for f in REQUIRED_FIELDS if not str(row.get(f, "")).strip()]
            if missing:
                raise ResourceSuggestionError(f"Row {i + 1} missing field(s): {missing}")
            if row["type"] not in VALID_TYPES:
                raise ResourceSuggestionError(
                    f"Row {i + 1} has invalid type '{row['type']}', must be one of {VALID_TYPES}."
                )
