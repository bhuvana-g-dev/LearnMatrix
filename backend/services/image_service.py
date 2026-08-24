"""
services/image_service.py

Provides ONE relevant visual per slide-deck "text" section (see
agents/slide_deck_agent.py); "list", "comparison", and "process"
sections already carry their own visual weight from icon badges and
multi-panel layout, so a photo/illustration there would just compete
for space rather than add anything.

Two sources, tried in order by services/slide_deck_service.py:
  1. generate_ai_image() — a creative, on-topic illustration made by
     Gemini's image model (utils/gemini_client.py's generate_image),
     using the section's own content as the creative brief. This is
     the preferred source since it's actually about THIS topic rather
     than a generic stock photo.
  2. find_photo_url() — a license-free stock photo via the Pexels API
     (https://www.pexels.com/api/), used whenever AI generation is
     unavailable or fails for any reason.

Degrades gracefully everywhere: a missing/invalid API key, a search/
generation with no results, or any network hiccup all just mean "no
image for this section" rather than failing deck generation — same
pattern as services/youtube_service.py's YOUTUBE_API_KEY handling.
"""

import base64

import requests

from config.settings import settings

PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"
REQUEST_TIMEOUT_SECONDS = 6
DOWNLOAD_TIMEOUT_SECONDS = 10


def generate_ai_image(query: str) -> bytes | None:
    """Generates one creative, on-topic illustration for a slide-deck
    'text' section via Gemini's image model, using the section's own
    heading/image_query as the creative brief. Returns raw image bytes,
    or None on any failure (missing GEMINI_API_KEY, safety block,
    network hiccup, unsupported model) — callers should fall back to
    find_photo_url() in that case; deck generation never depends on
    this succeeding."""
    if not query or not query.strip():
        return None
    from utils.gemini_client import generate_image

    prompt = (
        f"A clean, modern, minimalist digital illustration for a study "
        f"slide about: {query.strip()}. Flat design, simple shapes, "
        f"educational infographic style, navy blue and gold color "
        f"palette, plain or softly gradient background, no text, no "
        f"lettering, no watermarks, no logos in the image."
    )
    return generate_image(prompt)


DIAGRAM_ARCHETYPES = {
    "process": "a circular flywheel diagram with curved arrows connecting stages in a loop, OR a left-to-right numbered step-flow with connecting arrows",
    "comparison": "a symmetrical weighing-scale or split vertical-panel diagram contrasting two sides",
    "list": "a grid or radial cluster of labelled icon modules connected to a central concept",
    "text": "a conceptual explanatory diagram or chart (e.g. a rising trend line, layered pyramid, gauge/meter, or connected-node map) that visually represents the idea",
}


def generate_diagram_illustration(heading: str, description: str, layout: str) -> bytes | None:
    """Generates ONE large, full-panel diagram-style illustration for a
    slide, in the spirit of NotebookLM-style infographic decks (data
    diagrams, flywheels, gauges, pillars) rather than a generic stock
    photo or a small decorative graphic. Picks a diagram archetype from
    DIAGRAM_ARCHETYPES based on the slide's layout so a "process"
    section gets a flow/cycle diagram, a "comparison" section gets a
    scale/split-panel diagram, etc.

    Deliberately asks for NO text/lettering baked into the image — the
    real heading and key points are drawn as actual PowerPoint text
    elsewhere on the slide (editable, always spelled correctly), so the
    image only needs to carry the visual/diagrammatic weight. Returns
    None on any failure, same graceful-degradation contract as
    generate_ai_image."""
    if not heading or not heading.strip():
        return None
    from utils.gemini_client import generate_image

    archetype = DIAGRAM_ARCHETYPES.get(layout, DIAGRAM_ARCHETYPES["text"])
    brief = (description or "").strip()[:280]
    prompt = (
        f"A professional infographic-style diagram illustration for a presentation slide "
        f"titled '{heading.strip()}'. Concept to illustrate: {brief or heading.strip()}. "
        f"Render it as {archetype}. "
        f"Style: modern flat vector infographic, clean geometric shapes, subtle gradients and "
        f"soft shadows, navy blue and gold color palette, plenty of negative space, "
        f"widescreen 16:9 composition, centered composition with balanced margins. "
        f"Absolutely NO text, NO letters, NO numbers, NO labels, NO watermark, NO logos "
        f"anywhere in the image — diagram shapes and arrows only."
    )
    return generate_image(prompt)


def find_photo_url(query: str) -> str | None:
    """Returns a Pexels photo URL matching `query`, or None if
    unavailable. This is deliberately a URL, not the image bytes — the
    in-app slide-deck preview only needs a URL for an <img> tag, so
    fetching the actual bytes (fetch_image_bytes, below) is deferred
    until a pptx/pdf is actually being built."""
    if not settings.PEXELS_API_KEY or not query or not query.strip():
        return None
    try:
        resp = requests.get(
            PEXELS_SEARCH_URL,
            headers={"Authorization": settings.PEXELS_API_KEY},
            params={"query": query.strip(), "per_page": 1, "orientation": "landscape"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        photos = resp.json().get("photos", [])
        if not photos:
            return None
        src = photos[0].get("src", {})
        return src.get("large") or src.get("medium") or src.get("original")
    except Exception:
        return None


def fetch_image_bytes(url: str) -> bytes | None:
    """Downloads the actual image bytes for embedding into a pptx/pdf.
    Kept separate from find_photo_url so a preview-only request never
    pays this download cost, and a from-content download only pays it
    once per section regardless of how many times the deck was
    previewed first.

    Also accepts a "data:" URI directly (no network call) — this is how
    an AI-generated image (see generate_ai_image above) travels through
    the same "image_url" field the frontend preview already renders as
    an <img src>, so the pptx/pdf builders don't need a separate code
    path for AI vs. stock images."""
    if not url:
        return None
    if url.startswith("data:"):
        try:
            _, b64data = url.split(",", 1)
            return base64.b64decode(b64data)
        except Exception:
            return None
    try:
        resp = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS)
        resp.raise_for_status()
        return resp.content
    except Exception:
        return None


def image_bytes_to_data_uri(image_bytes: bytes, mime_type: str = "image/png") -> str:
    """Encodes raw image bytes as a data: URI so an AI-generated image
    can be stored directly in the deck content's "image_url" field —
    same field/shape a Pexels URL uses, so nothing downstream needs to
    know which source produced it."""
    return f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
