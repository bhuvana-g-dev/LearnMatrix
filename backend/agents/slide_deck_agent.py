"""
agents/slide_deck_agent.py

Turns a short student-typed prompt (e.g. "explain the RIP protocol,
features, pros and cons") into a FULL structured slide deck — a title,
a one-line summary, several content sections, and a closing set of key
takeaways — the same way Gamma/NotebookLM expand a one-line prompt into
a real presentation, instead of just dumping the raw prompt text onto
a single "Your Input" slide.

Each section also carries a "layout" tag — "text", "list", or
"comparison" — that the model picks based on the CONTENT, not just the
heading, e.g. a "Pros and Cons" section becomes "comparison" with a
left/right column, a "Key Features" section becomes "list" with short
card-sized items, and a narrative explanation stays "text". This is
what lets the deck look like an actual designed presentation (varied
layouts) instead of every slide being a heading + paragraph — the
model is better placed to judge which shape fits a section's content
than a keyword-matching heuristic downstream would be.

Output shape matches what services/ppt_service.py's
build_deck_sections()/build_pptx_from_deck_content() and
services/pdf_service.py's build_pdf_from_deck_content() expect:
    {"title": str, "summary": str,
     "sections": [{"heading": str, "content": str, "layout": str,
                    "items"?: [str], "left"?: {...}, "right"?: {...}}],
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
VALID_LAYOUTS = {"text", "list", "comparison"}


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
a short prompt or notes into a FULL, VISUALLY VARIED presentation, not
a wall of heading+paragraph slides that all look the same.

--- STUDENT INPUT START ---
{trimmed}
--- STUDENT INPUT END ---

Build a deck with:
- A short, clear title (3-8 words) for the overall topic.
- A one-sentence summary of what the deck covers.
- Between {MIN_SECTIONS} and {MAX_SECTIONS} content sections that break the
  topic into a logical sequence (e.g. definition/overview, how it works,
  key features, examples, comparisons, pros, cons, use cases — pick
  whichever sections actually fit this specific topic).

For EACH section, choose the layout that best fits its content:
- "comparison" — the section is naturally two contrasting sides (pros
  vs cons, advantages vs disadvantages, before vs after, X vs Y). Give
  "left" and "right", each a {{"label": str, "items": [3-5 short phrases]}}.
- "list" — the section is naturally a set of parallel items (features,
  steps, examples, types). Give "items": 3-6 short phrases (3-8 words
  each, no full sentences).
- "text" — a narrative explanation that doesn't reduce to a list or a
  two-sided comparison. Give "content": 2-4 sentences.

Every section still needs "heading" (2-5 words) and a "content" string
(a 1-2 sentence plain-text fallback summary of the section, even when
layout is "list" or "comparison" — used as the section's spoken/plain
description elsewhere in the app).

Use "comparison" and "list" layouts wherever the content genuinely fits
— a deck that's ALL "text" layout looks exactly like the plain version
this is meant to replace. Aim for at least half the sections to be
"list" or "comparison" when the topic supports it.

Also include 3-5 short "key takeaways" (one line each) summarizing the
most important points a student should remember.

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape (include "items" only for "list", "left"/"right" only for
"comparison" — omit whichever of those two doesn't apply):
{{
  "title": "<deck title>",
  "summary": "<one-sentence overview>",
  "sections": [
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "text"}},
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "list",
      "items": ["<short item 1>", "<short item 2>", "<short item 3>"]}},
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "comparison",
      "left": {{"label": "Pros", "items": ["<short item>", "<short item>"]}},
      "right": {{"label": "Cons", "items": ["<short item>", "<short item>"]}}}}
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

            layout = s.get("layout", "text")
            if layout not in VALID_LAYOUTS:
                s["layout"] = "text"  # unknown tag from the model — fall back rather than reject the whole deck
                layout = "text"

            if layout == "list":
                items = s.get("items")
                if not isinstance(items, list) or len(items) < 2:
                    s["layout"] = "text"  # malformed list payload — degrade to the plain text layout instead of failing
            elif layout == "comparison":
                left, right = s.get("left"), s.get("right")
                valid = (
                    isinstance(left, dict) and isinstance(right, dict)
                    and isinstance(left.get("items"), list) and isinstance(right.get("items"), list)
                    and len(left["items"]) >= 1 and len(right["items"]) >= 1
                )
                if not valid:
                    s["layout"] = "text"

        if "keyTakeaways" in raw and not isinstance(raw["keyTakeaways"], list):
            raise SlideDeckAgentError("'keyTakeaways' must be a list when present.")
