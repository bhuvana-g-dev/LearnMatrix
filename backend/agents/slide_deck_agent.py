"""
agents/slide_deck_agent.py

Turns a short student-typed prompt (e.g. "explain the RIP protocol,
features, pros and cons") into a FULL structured slide deck — a title,
a one-line summary, several content sections, and a closing set of key
takeaways — the same way Gamma/NotebookLM expand a one-line prompt into
a real presentation, instead of just dumping the raw prompt text onto
a single "Your Input" slide.

Each section carries a "layout" tag — "text", "list", "comparison", or
"process" — plus, for "list"/"process"/keyTakeaways, a small ICON tag
per item from a fixed vocabulary (see ICON_VOCAB below). The model
picks both based on the section's CONTENT, not just its heading: a
"Pros and Cons" section becomes "comparison", a "How It Works" section
becomes "process" (ordered steps), a "Key Features" section becomes
"list" with a fitting icon per feature. This is what makes the deck
look like a real designed presentation instead of a wall of identical
heading+paragraph slides — the model judges shape and iconography far
better than a downstream keyword heuristic could.

Deliberately does NOT ask the model for any numbers, statistics, or
chart data — a topic typed as a one-line prompt has no real dataset
behind it, so a bar/line chart here would mean the model inventing
plausible-looking numbers, which is misleading in a study tool. Visual
richness instead comes from layout variety + icons, not fabricated data.

Output shape matches what services/ppt_service.py's
build_deck_sections()/build_pptx_from_deck_content() and
services/pdf_service.py's build_pdf_from_deck_content() expect:
    {"title": str, "summary": str,
     "sections": [{"heading": str, "content": str, "layout": str,
                    "items"?: [{"text": str, "icon": str}],
                    "steps"?: [{"text": str}],
                    "left"?: {...}, "right"?: {...}}],
     "keyTakeaways": [{"text": str, "icon": str}, ...]}
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
VALID_LAYOUTS = {"text", "list", "comparison", "process"}
# Kept deliberately small — every icon here has a reliable-looking shape
# or glyph on BOTH the pptx and pdf builders (see services/ppt_service.py's
# _icon_badge / services/pdf_service.py's _draw_icon). A tag outside this
# set falls back to a plain checkmark rather than being rejected.
ICON_VOCAB = {"check", "star", "warning", "gear", "database", "network", "shield", "zap", "cloud", "book"}
DEFAULT_ICON = "check"


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
        icons = ", ".join(sorted(ICON_VOCAB))

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
- "process" — the section is naturally an ORDERED sequence (how
  something works step by step, a protocol handshake, a setup
  procedure). Give "steps": 3-5 short phrases (3-6 words each), in order.
- "list" — the section is naturally a set of PARALLEL, unordered items
  (features, examples, types, use cases). Give "items": 3-6 objects,
  each {{"text": "<3-8 word phrase>", "icon": "<one of: {icons}>"}} —
  pick whichever icon best matches that specific item's meaning (e.g.
  "warning" for a limitation, "database" for storage-related, "network"
  for connectivity-related, "shield" for security, "zap" for
  speed/performance, "gear" for configuration, "book" for a
  definition/concept, "star" for a standout feature, "check" as the
  general-purpose default).
- "text" — a narrative explanation that doesn't reduce to a list, a
  sequence, or a two-sided comparison. Give "content": 2-4 sentences.

Every section still needs "heading" (2-5 words) and a "content" string
(a 1-2 sentence plain-text fallback summary of the section, even when
layout is "list"/"comparison"/"process" — used as the section's plain
description elsewhere in the app).

Do NOT invent numbers, percentages, dates, or statistics anywhere —
this deck is built from a short prompt with no real dataset behind it,
so any figures would just be made up. Stick to qualitative, factual
statements.

Use "comparison", "list", and "process" layouts wherever the content
genuinely fits — a deck that's ALL "text" layout looks exactly like
the plain version this is meant to replace. Aim for at least half the
sections to use one of those three when the topic supports it.

Also include 3-5 short "key takeaways" — objects like
{{"text": "<one line>", "icon": "<one of: {icons}>"}} — summarizing the
most important points a student should remember.

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape (include only the fields that apply to each section's layout):
{{
  "title": "<deck title>",
  "summary": "<one-sentence overview>",
  "sections": [
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "text"}},
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "list",
      "items": [{{"text": "<short item>", "icon": "check"}}, {{"text": "<short item>", "icon": "database"}}]}},
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "process",
      "steps": [{{"text": "<step 1>"}}, {{"text": "<step 2>"}}, {{"text": "<step 3>"}}]}},
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "comparison",
      "left": {{"label": "Pros", "items": ["<short item>", "<short item>"]}},
      "right": {{"label": "Cons", "items": ["<short item>", "<short item>"]}}}}
  ],
  "keyTakeaways": [{{"text": "<takeaway 1>", "icon": "star"}}, {{"text": "<takeaway 2>", "icon": "check"}}]
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
                    s["layout"] = "text"
                else:
                    s["items"] = [self._normalize_icon_item(it) for it in items]
            elif layout == "process":
                steps = s.get("steps")
                if not isinstance(steps, list) or len(steps) < 2:
                    s["layout"] = "text"  # malformed step payload — degrade to plain text rather than failing
                else:
                    s["steps"] = [{"text": self._item_text(st)} for st in steps if self._item_text(st)]
                    if len(s["steps"]) < 2:
                        s["layout"] = "text"
            elif layout == "comparison":
                left, right = s.get("left"), s.get("right")
                valid = (
                    isinstance(left, dict) and isinstance(right, dict)
                    and isinstance(left.get("items"), list) and isinstance(right.get("items"), list)
                    and len(left["items"]) >= 1 and len(right["items"]) >= 1
                )
                if not valid:
                    s["layout"] = "text"

        if "keyTakeaways" in raw:
            takeaways = raw["keyTakeaways"]
            if not isinstance(takeaways, list):
                raise SlideDeckAgentError("'keyTakeaways' must be a list when present.")
            raw["keyTakeaways"] = [self._normalize_icon_item(t) for t in takeaways]

    @staticmethod
    def _item_text(item) -> str:
        if isinstance(item, dict):
            return str(item.get("text", "")).strip()
        return str(item).strip()

    @classmethod
    def _normalize_icon_item(cls, item) -> dict:
        """Accepts either a plain string or a {"text","icon"} object (the
        model doesn't always follow the icon-object shape consistently)
        and always returns a well-formed {"text","icon"} dict, falling
        back to DEFAULT_ICON for a missing/unrecognized icon tag."""
        if isinstance(item, dict):
            text = str(item.get("text", "")).strip()
            icon = item.get("icon")
        else:
            text, icon = str(item).strip(), None
        if icon not in ICON_VOCAB:
            icon = DEFAULT_ICON
        return {"text": text, "icon": icon}
