"""
agents/resource_suggestion_agent.py

Resource Suggestion Agent — the "AI suggests, human verifies" agent
requested directly by the team. Given a skill and a focus band
(fundamentals/application/advanced/polish — see services/focus_band.py
and config/settings.py's VALID_RESOURCE_BANDS), asks Gemini/Groq to
suggest candidate learning resources (videos, docs, GitHub repos) at
that level. Deliberately skill+band, not skill+topic — see
services/resource_repository.py's module docstring.

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

UPDATE (implemented): the "video" type has been removed from what this
agent is asked for — services/youtube_service.py now handles ALL video
suggestions via a real YouTube Data API v3 search, so a video result is
guaranteed to actually exist (title/channel/thumbnail/duration/views
all come straight from YouTube, never invented). This agent now covers
only the resource types where "ask the LLM to name a real URL" remains
the only available approach: documentation, articles, GitHub repos,
PDFs/cheat sheets, practice links — all still carry the same
hallucination risk described above, still gated behind the identical
pending -> review -> verified pipeline.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["title", "url", "type", "platform"]
# "video" deliberately excluded — see UPDATE note above.
VALID_TYPES = [t for t in settings.VALID_RESOURCE_TYPES if t != "video"]

# What "good" looks like for a resource at each band — same vocabulary/
# intent as agents/notes_generation_agent.py's FOCUS_BAND_GUIDANCE, kept
# as its own short copy here since this prompt asks for resource
# *selection* criteria, not notes-writing instructions.
BAND_GUIDANCE = {
    "fundamentals": "beginner-friendly resources that explain the topic from scratch, with simple language and basic examples",
    "application": "resources that show how to actually use this in practice — worked examples, common patterns, hands-on practice",
    "advanced": "resources covering edge cases, performance/design tradeoffs, and deeper internals — assume solid working knowledge already",
    "polish": "concise reference material — cheat sheets, quick-recall summaries, condensed guides for someone who already knows this well",
}


class ResourceSuggestionError(AgentError):
    pass


class ResourceSuggestionAgent(BaseAgent):
    name = "ResourceSuggestionAgent"

    def run(self, skill: str, band: str, count: int = 5) -> list[dict]:
        if not (1 <= count <= 10):
            raise ResourceSuggestionError("count must be between 1 and 10.")
        if band not in settings.VALID_RESOURCE_BANDS:
            raise ResourceSuggestionError(
                f"band must be one of {settings.VALID_RESOURCE_BANDS}, got '{band}'."
            )

        prompt = self._build_prompt(skill, band, count)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                # Small explicit cap — this call only ever returns up to
                # 10 short JSON objects (title/url/type/platform), a few
                # hundred tokens at most. Leaving max_tokens at
                # generate_json()'s 8192 default was blowing straight
                # through Groq's free-tier 8000 TPM limit on every call
                # (the REQUESTED max_tokens counts against that budget,
                # not just what's actually generated — see
                # utils/gemini_client.py's docstring), so Groq 413'd
                # regardless of how short the actual prompt/response was.
                raw = generate_json(prompt, max_tokens=1024)
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
            f"Resource suggestion for '{skill}' ({band}) failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(self, skill: str, band: str, count: int) -> str:
        types_list = " | ".join(f'"{t}"' for t in VALID_TYPES)
        guidance = BAND_GUIDANCE.get(band, "")
        return f"""Suggest {count} well-known, genuinely useful learning
resources for the skill "{skill}" — things a working developer would
actually recognize by name: official documentation, widely-used GitHub
repositories, well-known articles, downloadable PDF notes/cheat sheets,
or hands-on practice sites (e.g. an interactive exercise platform).

Target level: {band}. {guidance}

Only suggest resources you are highly confident actually exist under
that exact name and URL. If you are not confident a specific URL is
correct, suggest the resource's official homepage instead of guessing
a deep link.

Respond with ONLY a JSON array, no prose, no markdown fences, in this
exact shape:
[
  {{
    "title": "<resource name>",
    "url": "<url>",
    "type": {types_list},
    "platform": "<e.g. MDN, official docs, GitHub, freeCodeCamp>"
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
