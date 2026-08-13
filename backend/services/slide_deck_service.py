"""
services/slide_deck_service.py

Stateless — no Firestore involved. Routes call this directly with
whatever the student typed into the Slide Deck "Type" box. Returns the
same {title, summary, sections, keyTakeaways} shape used everywhere
else in the deck-building pipeline (ppt_service.py, pdf_service.py),
so the AI-generated content can be previewed in the app and then
handed straight to either file builder with no reshaping.

Also attaches a real photo URL (via services/image_service.py's
Pexels lookup) to each "text" layout section, using the AI's own
"image_query" for that section (see agents/slide_deck_agent.py). This
step is deliberately kept OUT of the agent itself — the agent's job is
producing search phrases from the topic, not knowing about Pexels,
network calls, or what happens when a lookup fails; keeping the two
separate means a Pexels outage degrades to "no photo on this section"
without touching the text-generation path at all.
"""

from agents.slide_deck_agent import SlideDeckAgent, SlideDeckAgentError
from services.image_service import find_photo_url

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
        url = find_photo_url(query)
        if url:
            section["image_url"] = url
