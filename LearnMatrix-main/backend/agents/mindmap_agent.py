"""
agents/mindmap_agent.py

Turns any block of text — combined source content, a chat transcript,
or a student-typed topic — into a proper multi-branch mind map: one
short title plus 4-7 branches, each with a short label and a one-line
detail. Same BaseAgent contract + generate_json() + retry pattern as
every other agent.

This replaces the earlier no-LLM approach (one node per source/message,
or a single "Your Input" node for typed text) — that produced a flat,
low-value diagram for anything that wasn't already pre-chunked into
multiple sources. Routing everything through one agent gives a
consistently useful breakdown regardless of where the text came from.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["title", "branches"]
MIN_BRANCHES = 3
MAX_BRANCHES = 8


class MindMapAgentError(AgentError):
    pass


class MindMapAgent(BaseAgent):
    name = "MindMapAgent"

    def run(self, text: str, label: str = "this material") -> dict:
        if not text or not text.strip():
            raise MindMapAgentError("text must be non-empty.")

        prompt = self._build_prompt(text, label)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, temperature=0.5)
                self._validate(raw)
                return raw
            except (GeminiClientError, MindMapAgentError) as exc:
                last_error = exc
                if attempt != settings.AI_GENERATION_MAX_RETRIES:
                    time.sleep(2)
                continue

        raise MindMapAgentError(
            f"Mind map generation failed after {settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(self, text: str, label: str) -> str:
        # Truncated defensively — a long source dump or chat transcript
        # doesn't need to be sent in full to extract 4-7 main ideas.
        trimmed = text[:12000]

        return f"""You are building a mind map from {label} for a
computer science student.

--- MATERIAL START ---
{trimmed}
--- MATERIAL END ---

Identify the CORE topic and break it into its main branches — the key
concepts, steps, or sub-topics a student would need to understand this
material. Each branch needs a short label (2-5 words, like a diagram
node) and a one-sentence plain-language detail.

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape:
{{
  "title": "<short overall topic title, 2-6 words>",
  "branches": [
    {{"label": "<short branch label>", "detail": "<one-sentence explanation>"}},
    ...
  ]
}}

Include between 4 and 7 branches — enough to be useful, not so many the
diagram gets cluttered. Do not include a branch that just restates the
title."""

    def _validate(self, raw: dict) -> None:
        if not isinstance(raw, dict):
            raise MindMapAgentError("Model response was not a JSON object.")
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise MindMapAgentError(f"Response missing required field(s): {missing}")
        branches = raw["branches"]
        if not isinstance(branches, list) or not (MIN_BRANCHES <= len(branches) <= MAX_BRANCHES + 2):
            raise MindMapAgentError(f"'branches' must be a list of roughly {MIN_BRANCHES}-{MAX_BRANCHES} items.")
        for i, b in enumerate(branches):
            if not isinstance(b, dict) or "label" not in b or "detail" not in b:
                raise MindMapAgentError(f"Branch at index {i} is missing 'label' or 'detail'.")
