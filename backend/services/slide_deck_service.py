"""
services/slide_deck_service.py

Stateless — no Firestore involved. Routes call this directly with
whatever the student typed into the Slide Deck "Type" box. Returns the
same {title, summary, sections, keyTakeaways} shape used everywhere
else in the deck-building pipeline (ppt_service.py, pdf_service.py),
so the AI-generated content can be previewed in the app and then
handed straight to either file builder with no reshaping.
"""

from agents.slide_deck_agent import SlideDeckAgent, SlideDeckAgentError

SlideDeckServiceError = SlideDeckAgentError


def generate_deck_content(text: str, label: str = "this topic") -> dict:
    agent = SlideDeckAgent()
    return agent.run(text=text, label=label)
