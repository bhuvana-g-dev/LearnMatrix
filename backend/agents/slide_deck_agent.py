"""
agents/slide_deck_agent.py

Turns a short student-typed prompt (e.g. "explain the RIP protocol,
features, pros and cons") into a FULL structured slide deck — a title,
a one-line summary, several content sections, and a closing set of key
takeaways — the same way Gamma/NotebookLM expand a one-line prompt into
a real presentation, instead of just dumping the raw prompt text onto
a single "Your Input" slide.

Output shape matches exactly what services/ppt_service.py's
build_deck_sections()/_build_pptx_from_notes() and
services/pdf_service.py's _build_pdf_from_notes() already expect:
    {"title": str, "summary": str,
     "sections": [{"heading": str, "content": str}, ...],
     "keyTakeaways": [str, ...]}
so this agent's output can be handed straight to either builder with
no reshaping — same contract MindMapAgent has with mindmap_service.py.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["title", "sections"]
MIN_SECTIONS = 4
MAX_SECTIONS = 8


class SlideDeckAgentError(AgentError):
    pass


class SlideDeckAgent(BaseAgent):
    name = "SlideDeckAgent"

    def run(self, text: str, label: str = "this topic") -> dict:
        if not text or not text.strip():
            raise SlideDeckAgentError("text must be non-empty.")

        prompt = self._build_prompt(text, label)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, temperature=0.6)
                self._validate(raw)
                return raw
            except (GeminiClientError, SlideDeckAgentError) as exc:
                last_error = exc
                if attempt != settings.AI_GENERATION_MAX_RETRIES:
                    time.sleep(2)
                continue

        raise SlideDeckAgentError(
            f"Slide deck generation failed after {settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(self, text: str, label: str) -> str:
        trimmed = text[:6000]

        return f"""You are building a study slide deck from {label} for a
computer science student, in the style of Gamma or NotebookLM — expand
a short prompt or notes into a FULL, well-structured presentation, not
a single slide restating the input verbatim.

--- STUDENT INPUT START ---
{trimmed}
--- STUDENT INPUT END ---

Build a deck with:
- A short, clear title (3-8 words) for the overall topic.
- A one-sentence summary of what the deck covers.
- Between {MIN_SECTIONS} and {MAX_SECTIONS} content sections that break the
  topic into a logical sequence (e.g. definition/overview, how it works,
  key features, examples, comparisons, pros, cons, use cases — pick
  whichever sections actually fit this specific topic). Each section
  needs a short heading (2-5 words) and 2-4 sentences of real
  explanatory content — specific and informative, not generic filler.
- 3-5 short "key takeaways" (one line each) that summarize the most
  important points a student should remember.

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape:
{{
  "title": "<deck title>",
  "summary": "<one-sentence overview>",
  "sections": [
    {{"heading": "<section heading>", "content": "<2-4 sentences>"}}
  ],
  "keyTakeaways": ["<takeaway 1>", "<takeaway 2>"]
}}"""

    def _validate(self, raw: dict) -> None:
        if not isinstance(raw, dict):
            raise SlideDeckAgentError("Model response was not a JSON object.")
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise SlideDeckAgentError(f"Response missing required field(s): {missing}")
        sections = raw["sections"]
        if not isinstance(sections, list) or len(sections) < 2:
            raise SlideDeckAgentError("'sections' must be a non-trivial list.")
        for i, s in enumerate(sections):
            if not isinstance(s, dict) or "heading" not in s or "content" not in s:
                raise SlideDeckAgentError(f"Section at index {i} is missing 'heading' or 'content'.")
        if "keyTakeaways" in raw and not isinstance(raw["keyTakeaways"], list):
            raise SlideDeckAgentError("'keyTakeaways' must be a list when present.")
