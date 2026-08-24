"""
agents/slide_deck_agent.py

AI Presentation Planning Agent for LearnMatrix.

This agent does not only generate slide content. It also creates a
design brief for every slide so the PPT renderer can decide HOW the
idea should be presented visually.

The output remains backward compatible with the existing renderer:
    layout:
        text | list | process | comparison

Additional design intelligence:
    design_type
    visual_intent
    visual_priority
    text_density
    emphasis
    image_query

The current PPT renderer may ignore these additional fields temporarily.
Later renderer updates will use them to create more professional and
visually varied slides.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError


REQUIRED_FIELDS = ["title", "sections"]

MIN_SECTIONS = 5
MAX_SECTIONS = 10

# Existing renderer-compatible layouts
VALID_LAYOUTS = {
    "text",
    "list",
    "comparison",
    "process",
}

# New design intelligence categories
VALID_DESIGN_TYPES = {
    "hero",
    "big_statement",
    "concept",
    "timeline",
    "process_flow",
    "cycle",
    "comparison",
    "before_after",
    "architecture",
    "data_story",
    "icon_grid",
    "problem_solution",
    "visual_metaphor",
    "case_study",
    "summary",
    "feature_showcase",
    "application_map",
}

VALID_TEXT_DENSITY = {
    "low",
    "medium",
    "high",
}

VALID_VISUAL_PRIORITY = {
    "low",
    "medium",
    "high",
}

ICON_VOCAB = {
    "check",
    "star",
    "warning",
    "gear",
    "database",
    "network",
    "shield",
    "zap",
    "cloud",
    "book",
}

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

        for attempt in range(
            settings.AI_GENERATION_MAX_RETRIES + 1
        ):
            try:
                raw = generate_json(
                    prompt,
                    temperature=0.65
                )

                self._validate(raw)

                return raw

            except (
                GeminiClientError,
                SlideDeckAgentError
            ) as exc:
                last_error = exc

                if attempt != settings.AI_GENERATION_MAX_RETRIES:
                    time.sleep(2)

                continue

        raise SlideDeckAgentError(
            f"Slide deck generation failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): "
            f"{last_error}"
        )

    def _build_prompt(self, text: str, label: str) -> str:
        trimmed = text[:6000]

        icons = ", ".join(
            sorted(ICON_VOCAB)
        )

        return f"""
You are an expert AI Presentation Director.

Your job is NOT simply to write content for PowerPoint slides.

Your job is to think like a professional presentation designer and
decide how every idea should be communicated visually.

You are creating a high-quality educational presentation from
{label} for a student.

The presentation should feel like a professionally designed AI
presentation with visual storytelling, varied layouts, strong visual
hierarchy, and minimal unnecessary text.

--- STUDENT INPUT START ---
{trimmed}
--- STUDENT INPUT END ---

==================================================
CORE PRESENTATION PRINCIPLE
==================================================

Every slide must communicate ONE main idea.

Do NOT create slides that are simply:

Title
+
Large paragraph
+
Bullet points

Instead, first understand the idea and decide:

1. What is the core message?
2. What should the audience understand in 3 seconds?
3. What visual structure best communicates this idea?
4. How much text is actually necessary?
5. What kind of visual should support the message?

==================================================
PRESENTATION STRUCTURE
==================================================

Create between {MIN_SECTIONS} and {MAX_SECTIONS}
content sections.

The presentation should have a strong narrative flow.

Possible flow:

- Introduction
- Core concept
- Background or history
- How it works
- Key features
- Applications
- Advantages and limitations
- Comparison
- Examples
- Key insights
- Conclusion

Do NOT blindly use this structure.
Choose the best structure for the actual topic.

==================================================
DESIGN TYPES
==================================================

For EACH section choose ONE design_type:

1. "hero"
   Use for powerful introductions or major concepts.

2. "big_statement"
   Use for one strong idea that should dominate the slide.

3. "concept"
   Use for explaining a definition or core concept.

4. "timeline"
   Use for history, evolution, stages over time, or chronological events.

5. "process_flow"
   Use for step-by-step systems or workflows.

6. "cycle"
   Use for repeating systems or feedback loops.

7. "comparison"
   Use for two contrasting concepts.

8. "before_after"
   Use for transformation or change.

9. "architecture"
   Use for technical systems, components, or relationships.

10. "data_story"
    Use only when meaningful qualitative trends or relationships can
    be visualized WITHOUT inventing numerical data.

11. "icon_grid"
    Use for features, categories, or applications.

12. "problem_solution"
    Use when explaining a challenge and its solution.

13. "visual_metaphor"
    Use when an abstract idea can be communicated through a strong
    visual metaphor.

14. "case_study"
    Use for examples or real-world scenarios.

15. "summary"
    Use for major conclusions or key takeaways.

16. "feature_showcase"
    Use when highlighting important capabilities.

17. "application_map"
    Use when showing different real-world applications or domains.

IMPORTANT:
Do NOT repeat the same design_type unnecessarily.

A 10-slide deck should ideally contain several different visual
structures.

==================================================
TEXT RULES
==================================================

Prefer LOW text density.

Do NOT write 100+ word paragraphs for a normal presentation slide.

Use:

- 1 strong core message
- Short supporting explanation
- 3 to 5 concise supporting points when needed
- Visual-first storytelling

A slide should normally contain approximately 20 to 60 words.

Only use more content when absolutely necessary.

==================================================
VISUAL PLANNING
==================================================

For EVERY section provide:

"visual_intent"

This must explain what visual structure should communicate the idea.

Examples:

"The rise and collapse of AI funding shown as a dramatic trend curve."

"A circular cycle showing expectation, hype, disappointment, and
funding decline."

"A technical architecture showing components connected through arrows."

"A split visual comparing interpreted and compiled execution."

"An ecosystem map connecting Python to web development, data science,
automation, and AI."

Do NOT write generic visual_intent values like:

"Add an image"
"Use graphics"
"Make it attractive"

Be specific about the actual visual composition.

==================================================
VISUAL PRIORITY
==================================================

Choose:

"high"
"medium"
"low"

Most important conceptual slides should usually have "high".

==================================================
TEXT DENSITY
==================================================

Choose:

"low"
"medium"
"high"

Most presentation slides should use "low" or "medium".

==================================================
EMPHASIS
==================================================

Provide a short phrase describing the element that should visually
stand out most on the slide.

Examples:

"The interpreter"

"The funding collapse"

"The comparison between two approaches"

"The circular feedback loop"

"The four major applications"

==================================================
LAYOUT FIELD
==================================================

The renderer currently supports these layout values:

"text"
"list"
"process"
"comparison"

Choose the closest compatible layout.

IMPORTANT:

The "layout" field is technical renderer compatibility.

The "design_type" field describes the actual intended professional
visual design.

For example:

A timeline may temporarily use:
layout = "process"
design_type = "timeline"

An architecture may temporarily use:
layout = "process"
design_type = "architecture"

A visual metaphor may temporarily use:
layout = "text"
design_type = "visual_metaphor"

==================================================
CONTENT BY LAYOUT
==================================================

For "text":

Provide:

- heading
- content
- subpoints
- image_query

Content should normally be concise and visually presentation-friendly.

For "list":

Provide:

- heading
- content
- items

Each item must be:

{{
  "text": "...",
  "icon": "..."
}}

Use 3 to 6 items.

For "process":

Provide:

- heading
- content
- steps

Use 3 to 6 steps.

Each step:

{{
  "text": "..."
}}

For "comparison":

Provide:

- heading
- content
- left
- right

Each side must contain:

{{
  "label": "...",
  "items": ["...", "..."]
}}

==================================================
ACCURACY RULES
==================================================

Do NOT invent:

- Statistics
- Percentages
- Dates
- Research results
- Numerical performance claims

unless they are clearly present in the student's provided content.

Do not fabricate data just to create a chart.

==================================================
IMAGE QUERY
==================================================

Every section should include "image_query".

It should be a short search phrase describing the desired visual.

Examples:

"python programming code"

"machine learning workflow"

"computer network architecture"

"artificial intelligence history"

"data science ecosystem"

==================================================
KEY TAKEAWAYS
==================================================

Include 4 to 6 key takeaways.

Each:

{{
  "text": "...",
  "icon": "..."
}}

==================================================
REQUIRED JSON FORMAT
==================================================

Return ONLY a valid JSON object.

Use exactly this structure:

{{
  "title": "<deck title>",

  "summary": "<short overview>",

  "sections": [
    {{
      "heading": "<slide title>",

      "content": "<concise explanation>",

      "layout": "text",

      "design_type": "concept",

      "visual_intent": "<specific visual composition>",

      "visual_priority": "high",

      "text_density": "low",

      "emphasis": "<main visual focus>",

      "subpoints": [
        {{"text": "<short key point>"}},
        {{"text": "<short key point>"}},
        {{"text": "<short key point>"}}
      ],

      "image_query": "<visual search phrase>"
    }},

    {{
      "heading": "<slide title>",

      "content": "<short explanation>",

      "layout": "process",

      "design_type": "timeline",

      "visual_intent": "<timeline visual explanation>",

      "visual_priority": "high",

      "text_density": "low",

      "emphasis": "<main focus>",

      "image_query": "<visual search phrase>",

      "steps": [
        {{"text": "<step 1>"}},
        {{"text": "<step 2>"}},
        {{"text": "<step 3>"}}
      ]
    }},

    {{
      "heading": "<slide title>",

      "content": "<short explanation>",

      "layout": "comparison",

      "design_type": "comparison",

      "visual_intent": "<split comparison visual>",

      "visual_priority": "high",

      "text_density": "medium",

      "emphasis": "<main contrast>",

      "image_query": "<visual search phrase>",

      "left": {{
        "label": "<left side>",
        "items": [
          "<item>",
          "<item>"
        ]
      }},

      "right": {{
        "label": "<right side>",
        "items": [
          "<item>",
          "<item>"
        ]
      }}
    }}
  ],

  "keyTakeaways": [
    {{
      "text": "<takeaway>",
      "icon": "star"
    }}
  ]
}}
"""

    def _validate(self, raw: dict) -> None:
        if not isinstance(raw, dict):
            raise SlideDeckAgentError(
                "Model response was not a JSON object."
            )

        missing = [
            field
            for field in REQUIRED_FIELDS
            if field not in raw
        ]

        if missing:
            raise SlideDeckAgentError(
                f"Response missing required field(s): {missing}"
            )

        sections = raw["sections"]

        if (
            not isinstance(sections, list)
            or len(sections) < 2
        ):
            raise SlideDeckAgentError(
                "'sections' must be a non-trivial list."
            )

        for index, section in enumerate(sections):

            if (
                not isinstance(section, dict)
                or "heading" not in section
                or "content" not in section
            ):
                raise SlideDeckAgentError(
                    f"Section at index {index} is missing "
                    "'heading' or 'content'."
                )

            self._normalize_design_fields(section)

            original_layout = section.get(
                "layout",
                "text"
            )

            layout = original_layout

            if layout not in VALID_LAYOUTS:
                section["layout"] = "text"
                layout = "text"

            if layout == "list":
                self._validate_list_section(section)

            elif layout == "process":
                self._validate_process_section(section)

            elif layout == "comparison":
                self._validate_comparison_section(section)

            if section.get("layout") == "text":
                self._normalize_text_section(section)

        if "keyTakeaways" in raw:

            takeaways = raw["keyTakeaways"]

            if not isinstance(takeaways, list):
                raise SlideDeckAgentError(
                    "'keyTakeaways' must be a list."
                )

            raw["keyTakeaways"] = [
                self._normalize_icon_item(item)
                for item in takeaways
            ]

    def _normalize_design_fields(
        self,
        section: dict
    ) -> None:

        design_type = section.get(
            "design_type",
            "concept"
        )

        if design_type not in VALID_DESIGN_TYPES:
            design_type = "concept"

        section["design_type"] = design_type

        visual_priority = section.get(
            "visual_priority",
            "medium"
        )

        if visual_priority not in VALID_VISUAL_PRIORITY:
            visual_priority = "medium"

        section["visual_priority"] = visual_priority

        text_density = section.get(
            "text_density",
            "low"
        )

        if text_density not in VALID_TEXT_DENSITY:
            text_density = "low"

        section["text_density"] = text_density

        visual_intent = str(
            section.get(
                "visual_intent",
                ""
            )
        ).strip()

        if not visual_intent:
            visual_intent = (
                f"Visual explanation of "
                f"{section.get('heading', 'this concept')}"
            )

        section["visual_intent"] = visual_intent

        emphasis = str(
            section.get(
                "emphasis",
                section.get("heading", "")
            )
        ).strip()

        section["emphasis"] = emphasis

        image_query = str(
            section.get(
                "image_query",
                section.get("heading", "")
            )
        ).strip()

        section["image_query"] = image_query

    def _validate_list_section(
        self,
        section: dict
    ) -> None:

        items = section.get("items")

        if (
            not isinstance(items, list)
            or len(items) < 2
        ):
            section["layout"] = "text"
            return

        section["items"] = [
            self._normalize_icon_item(item)
            for item in items
        ]

    def _validate_process_section(
        self,
        section: dict
    ) -> None:

        steps = section.get("steps")

        if (
            not isinstance(steps, list)
            or len(steps) < 2
        ):
            section["layout"] = "text"
            return

        cleaned_steps = []

        for step in steps:
            text = self._item_text(step)

            if text:
                cleaned_steps.append({
                    "text": text
                })

        if len(cleaned_steps) < 2:
            section["layout"] = "text"
            return

        section["steps"] = cleaned_steps

    def _validate_comparison_section(
        self,
        section: dict
    ) -> None:

        left = section.get("left")
        right = section.get("right")

        valid = (
            isinstance(left, dict)
            and isinstance(right, dict)
            and isinstance(left.get("items"), list)
            and isinstance(right.get("items"), list)
            and len(left["items"]) >= 1
            and len(right["items"]) >= 1
        )

        if not valid:
            section["layout"] = "text"

    def _normalize_text_section(
        self,
        section: dict
    ) -> None:

        subpoints = section.get("subpoints")

        if (
            isinstance(subpoints, list)
            and subpoints
        ):
            cleaned = []

            for subpoint in subpoints:
                text = self._item_text(subpoint)

                if text:
                    cleaned.append({
                        "text": text
                    })

            if cleaned:
                section["subpoints"] = cleaned
            else:
                section.pop(
                    "subpoints",
                    None
                )

        else:
            section.pop(
                "subpoints",
                None
            )

    @staticmethod
    def _item_text(item) -> str:

        if isinstance(item, dict):
            return str(
                item.get("text", "")
            ).strip()

        return str(item).strip()

    @classmethod
    def _normalize_icon_item(
        cls,
        item
    ) -> dict:

        if isinstance(item, dict):
            text = str(
                item.get("text", "")
            ).strip()

            icon = item.get("icon")

        else:
            text = str(item).strip()
            icon = None

        if icon not in ICON_VOCAB:
            icon = DEFAULT_ICON

        return {
            "text": text,
            "icon": icon
        }
