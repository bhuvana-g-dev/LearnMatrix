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
MIN_SECTIONS = 5
MAX_SECTIONS = 10
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
a short prompt or notes into a FULL, DETAILED, VISUALLY VARIED
presentation. Every slide must be genuinely substantial, the way Gamma
or NotebookLM write a deck — NOT a thin 3-5 line summary slide and NOT
a wall of identical heading+paragraph slides either.

--- STUDENT INPUT START ---
{trimmed}
--- STUDENT INPUT END ---

Build a deck with:
- A short, clear title (3-8 words) for the overall topic.
- A two-to-three sentence summary of what the deck covers and why it matters.
- Between {MIN_SECTIONS} and {MAX_SECTIONS} content sections that break the
  topic into a logical, thorough sequence (e.g. definition/overview,
  background/context, how it works internally, key features, real-world
  examples, comparisons, pros, cons, common pitfalls, use cases, best
  practices — pick whichever sections actually fit this specific topic,
  and go deep rather than staying surface-level).

For EACH section, choose the layout that best fits its content:
- "comparison" — the section is naturally two contrasting sides (pros
  vs cons, advantages vs disadvantages, before vs after, X vs Y). Give
  "left" and "right", each a {{"label": str, "items": [4-6 short phrases,
  each with enough specificity to stand alone — not just one word]}}.
- "process" — the section is naturally an ORDERED sequence (how
  something works step by step, a protocol handshake, a setup
  procedure). Give "steps": 4-6 phrases (5-10 words each, specific
  enough to actually explain that step, not just a label), in order.
- "list" — the section is naturally a set of PARALLEL, unordered items
  (features, examples, types, use cases). Give "items": 4-6 objects,
  each {{"text": "<one full descriptive sentence, 8-16 words, that
  explains the item, not just names it>", "icon": "<one of: {icons}>"}}
  — pick whichever icon best matches that specific item's meaning (e.g.
  "warning" for a limitation, "database" for storage-related, "network"
  for connectivity-related, "shield" for security, "zap" for
  speed/performance, "gear" for configuration, "book" for a
  definition/concept, "star" for a standout feature, "check" as the
  general-purpose default).
- "text" — a narrative explanation that doesn't reduce to a list, a
  sequence, or a two-sided comparison. Give "content": a FULL, RICH
  explanation — AT LEAST 90 WORDS, ideally 120-160 words, across 5-8
  sentences (multiple paragraphs' worth of substance — define the
  concept, explain WHY it matters, give context or an example, not just
  a one-line definition). Never settle for 2-3 short sentences here —
  if your first draft of "content" is under 90 words, expand it with
  more concrete explanation before finalizing the JSON. ALSO give
  "subpoints": 3-5 short supporting bullet phrases (4-10 words each)
  that highlight the most important facts from that section at a
  glance, like the "key points" callouts Gamma/NotebookLM add beside a
  long paragraph.

Every section still needs "heading" (2-5 words) and a "content" string.
For "list"/"comparison"/"process" layouts, "content" is a 1-2 sentence
plain-text fallback summary of the section (used as its plain
description elsewhere in the app) — it does NOT need to be as long as a
"text" layout's "content".

Do NOT invent numbers, percentages, dates, or statistics anywhere —
this deck is built from a short prompt with no real dataset behind it,
so any figures would just be made up. Stick to qualitative, factual
statements, but be thorough and specific with the qualitative detail
you do give — avoid vague filler sentences that could apply to any topic.

Use "comparison", "list", and "process" layouts wherever the content
genuinely fits — a deck that's ALL "text" layout looks exactly like
the plain version this is meant to replace. Aim for at least half the
sections to use one of those three when the topic supports it.

Also include 4-6 "key takeaways" — objects like {{"text": "<one full
sentence, 8-14 words, specific to this topic — not a generic
platitude>", "icon": "<one of: {icons}>"}} — summarizing the most
important points a student should remember after this deck.

Also give EACH "text" layout section an "image_query": a short (2-5
word) plain-English visual search phrase that captures what a fitting
illustrative image for that section would show (e.g. "server data
center racks", "handshake network diagram") — used to find or generate
a matching picture for that slide.

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape (include only the fields that apply to each section's layout):
{{
  "title": "<deck title>",
  "summary": "<two-to-three sentence overview>",
  "sections": [
    {{"heading": "<heading>", "content": "<5-8 sentence rich explanation>", "layout": "text",
      "subpoints": [{{"text": "<short highlight 1>"}}, {{"text": "<short highlight 2>"}}, {{"text": "<short highlight 3>"}}],
      "image_query": "<2-5 word visual search phrase>"}},
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "list",
      "items": [{{"text": "<full descriptive sentence>", "icon": "check"}}, {{"text": "<full descriptive sentence>", "icon": "database"}}]}},
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "process",
      "steps": [{{"text": "<detailed step 1>"}}, {{"text": "<detailed step 2>"}}, {{"text": "<detailed step 3>"}}]}},
    {{"heading": "<heading>", "content": "<1-2 sentence summary>", "layout": "comparison",
      "left": {{"label": "Pros", "items": ["<specific item>", "<specific item>"]}},
      "right": {{"label": "Cons", "items": ["<specific item>", "<specific item>"]}}}}
  ],
  "keyTakeaways": [{{"text": "<specific takeaway 1>", "icon": "star"}}, {{"text": "<specific takeaway 2>", "icon": "check"}}]
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

            original_layout = s.get("layout", "text")  # captured before any fallback demotion below
            layout = original_layout
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

            if s["layout"] == "text":
                # Short highlight bullets alongside the long-form paragraph
                # (see module docstring) — optional, so a model that omits
                # them just falls back to plain paragraph-only text.
                subpoints = s.get("subpoints")
                if isinstance(subpoints, list) and subpoints:
                    cleaned = [self._item_text(sp) for sp in subpoints]
                    s["subpoints"] = [{"text": t} for t in cleaned if t]
                    if not s["subpoints"]:
                        s.pop("subpoints", None)
                else:
                    s.pop("subpoints", None)

                # Enforce the "AT LEAST 90 WORDS" instruction above rather
                # than trusting the model to have followed it — but only
                # for a section the model genuinely intended as "text";
                # a section DEMOTED here from list/process/comparison
                # (malformed items/steps/sides) legitimately only has its
                # short 1-2 sentence fallback summary, so it's exempt —
                # otherwise every malformed list would force a pointless
                # whole-deck retry instead of just rendering as text.
                if original_layout == "text":
                    word_count = len(s["content"].split())
                    if word_count < 60:
                        raise SlideDeckAgentError(
                            f"Section '{s.get('heading', '?')}' content is only {word_count} words "
                            "(need >=60) — model under-delivered on the full-depth 'text' layout."
                        )

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
