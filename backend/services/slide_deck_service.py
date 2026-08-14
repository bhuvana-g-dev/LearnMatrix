"""
services/slide_deck_service.py

Stateless — no Firestore involved. Routes call this directly with
whatever the student typed into the Slide Deck "Type" box. Returns the
same {title, summary, sections, keyTakeaways} shape used everywhere
else in the deck-building pipeline (ppt_service.py, pdf_service.py),
so the AI-generated content can be previewed in the app and then
handed straight to either file builder with no reshaping.

Also attaches ONE image to each "text" layout section, using the AI's
own "image_query" for that section (see agents/slide_deck_agent.py).
Two sources, tried in order (see services/image_service.py):
  1. generate_ai_image() — a creative illustration made by Gemini's
     image model, actually about this section's content.
  2. find_photo_url() — a Pexels stock photo, used whenever AI
     generation is unavailable or fails.
This step is deliberately kept OUT of the agent itself — the agent's
job is producing search phrases from the topic, not knowing about
image APIs, network calls, or what happens when a lookup fails; keeping
the two separate means an image-source outage degrades to "no photo on
this section" without touching the text-generation path at all.
"""

from agents.slide_deck_agent import SlideDeckAgent, SlideDeckAgentError
from services.image_service import find_photo_url, generate_ai_image, image_bytes_to_data_uri

SlideDeckServiceError = SlideDeckAgentError


def generate_deck_content(text: str, label: str = "this topic") -> dict:
    agent = SlideDeckAgent()
    notes = agent.run(text=text, label=label)
    _attach_section_images(notes)
    return notes


def _attach_section_images(notes: dict) -> None:
    for section in notes.get("sections", []):
        if section.get("layout", "text") != "text":
            continue  # list/comparison/process already carry their own visual weight (see module docstring)
        query = section.get("image_query") or section.get("heading")

        image_bytes = generate_ai_image(query)
        if image_bytes:
            # Data URI so the frontend preview (<img src=...>) and the
            # pptx/pdf builders (image_service.fetch_image_bytes) both
            # work with zero extra code path — see image_service.py.
            section["image_url"] = image_bytes_to_data_uri(image_bytes)
            continue

        url = find_photo_url(query)
        if url:
            section["image_url"] = url
