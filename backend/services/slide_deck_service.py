"""
services/slide_deck_service.py

Presentation generation service for LearnMatrix.

This service sits between the AI Presentation Director and the
presentation renderers.

Responsibilities:

1. Generate structured slide content.
2. Read each slide's design brief.
3. Decide whether the slide needs a visual asset.
4. Build a richer visual prompt using:
   - design_type
   - visual_intent
   - emphasis
   - heading
5. Generate an AI visual first.
6. Fall back to a stock photo when appropriate.

The service does NOT decide the presentation story. That happens inside
SlideDeckAgent.

The service does NOT decide final slide placement. That happens inside
ppt_service.py.

Its responsibility is only to prepare visual assets for the design
pipeline.
"""

from agents.slide_deck_agent import (
    SlideDeckAgent,
    SlideDeckAgentError,
)

from services.image_service import (
    find_photo_url,
    generate_ai_image,
    image_bytes_to_data_uri,
)


SlideDeckServiceError = SlideDeckAgentError


# ------------------------------------------------------------
# DESIGN TYPES THAT BENEFIT FROM A GENERATED VISUAL
# ------------------------------------------------------------

VISUAL_DESIGN_TYPES = {
    "hero",
    "big_statement",
    "concept",
    "timeline",
    "process_flow",
    "cycle",
    "architecture",
    "data_story",
    "visual_metaphor",
    "case_study",
    "feature_showcase",
    "application_map",
}


# ------------------------------------------------------------
# DESIGN TYPES WHERE A STOCK PHOTO CAN ALSO WORK
# ------------------------------------------------------------

PHOTO_FRIENDLY_DESIGN_TYPES = {
    "hero",
    "concept",
    "case_study",
    "feature_showcase",
    "application_map",
}


def generate_deck_content(
    text: str,
    label: str = "this topic",
) -> dict:
    """
    Generates the presentation structure and prepares visual assets.

    Pipeline:

        Student Input
             ↓
        SlideDeckAgent
             ↓
        Design Brief Per Slide
             ↓
        Visual Decision
             ↓
        AI Visual Generation
             ↓
        Stock Photo Fallback
             ↓
        Return Presentation Data
    """

    agent = SlideDeckAgent()

    notes = agent.run(
        text=text,
        label=label,
    )

    _attach_section_visuals(notes)

    return notes


def _attach_section_visuals(
    notes: dict,
) -> None:
    """
    Attach visuals based on each slide's design brief.

    The previous implementation generated images only for:

        layout == "text"

    That approach is too limited because a timeline, architecture,
    process, concept, or visual metaphor may also need a custom visual.

    The renderer may not yet use every attached visual. That is okay.
    We prepare the visual data now so the next renderer upgrade can use
    it without changing the generation pipeline again.
    """

    for section in notes.get("sections", []):

        if not isinstance(section, dict):
            continue

        if not _should_generate_visual(section):
            continue

        visual_prompt = _build_visual_prompt(section)

        image_bytes = generate_ai_image(
            visual_prompt
        )

        if image_bytes:

            section["image_url"] = (
                image_bytes_to_data_uri(
                    image_bytes
                )
            )

            section["visual_source"] = (
                "ai_generated"
            )

            continue

        # Only use stock photos when the design type is naturally
        # compatible with photography.
        #
        # For diagrams, timelines, cycles, architecture, etc., a random
        # stock image usually makes the slide worse rather than better.

        design_type = section.get(
            "design_type",
            "concept",
        )

        if design_type not in (
            PHOTO_FRIENDLY_DESIGN_TYPES
        ):
            continue

        photo_query = _build_photo_query(
            section
        )

        url = find_photo_url(
            photo_query
        )

        if url:

            section["image_url"] = url

            section["visual_source"] = (
                "stock_photo"
            )


def _should_generate_visual(
    section: dict,
) -> bool:
    """
    Decide whether this slide deserves a generated visual.

    Rules:

    HIGH priority:
        Generate visual whenever the design type supports visuals.

    MEDIUM priority:
        Generate visual for visually expressive design types.

    LOW priority:
        Usually keep the slide clean unless it is a hero or
        visual-metaphor slide.
    """

    design_type = section.get(
        "design_type",
        "concept",
    )

    visual_priority = section.get(
        "visual_priority",
        "medium",
    )

    if design_type not in (
        VISUAL_DESIGN_TYPES
    ):
        return False

    if visual_priority == "high":
        return True

    if visual_priority == "medium":

        return design_type in {
            "hero",
            "concept",
            "process_flow",
            "architecture",
            "visual_metaphor",
            "case_study",
            "feature_showcase",
            "application_map",
        }

    if visual_priority == "low":

        return design_type in {
            "hero",
            "visual_metaphor",
        }

    return False


def _build_visual_prompt(
    section: dict,
) -> str:
    """
    Convert the slide's design brief into a richer image-generation
    query.

    Example:

    Instead of:

        "Python programming"

    the AI image generator receives something closer to:

        "Visual metaphor showing Python as a bridge connecting
        beginners, automation, data science and AI."

    This produces visuals that are more connected to the actual
    slide story.
    """

    heading = str(
        section.get(
            "heading",
            "",
        )
    ).strip()

    design_type = str(
        section.get(
            "design_type",
            "concept",
        )
    ).strip()

    visual_intent = str(
        section.get(
            "visual_intent",
            "",
        )
    ).strip()

    emphasis = str(
        section.get(
            "emphasis",
            "",
        )
    ).strip()

    image_query = str(
        section.get(
            "image_query",
            "",
        )
    ).strip()

    content = str(
        section.get(
            "content",
            "",
        )
    ).strip()

    return (
        f"Presentation topic: {heading}. "
        f"Design type: {design_type}. "
        f"Visual concept: {visual_intent}. "
        f"Main visual emphasis: {emphasis}. "
        f"Supporting context: {image_query}. "
        f"Slide idea: {content[:300]}. "
        "Create a single clean presentation-ready visual that "
        "communicates the concept immediately. Avoid generic stock "
        "photography. Use a strong visual composition, clear subject "
        "hierarchy, modern educational presentation aesthetics, and "
        "minimal visual clutter."
    )


def _build_photo_query(
    section: dict,
) -> str:
    """
    Build a short query for Pexels.

    Stock search works better with short concrete phrases than with
    long design briefs.
    """

    image_query = str(
        section.get(
            "image_query",
            "",
        )
    ).strip()

    heading = str(
        section.get(
            "heading",
            "",
        )
    ).strip()

    design_type = str(
        section.get(
            "design_type",
            "",
        )
    ).strip()

    if image_query:
        return image_query

    if design_type == "hero":
        return heading

    return heading
