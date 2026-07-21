"""
services/learning_content_service.py

The actual "brain" of the Learning System's content delivery
(LEARNING_SYSTEM_ARCHITECTURE.md §3). Given (skill, topic, focus_band):

  1. Check services/notes_repository.py for a cached AI-generated
     notes set at that exact key.
  2. Cache miss -> call NotesGenerationAgent, save the result, then
     continue as if it had been a cache hit. Cache hit -> skip
     generation entirely (no AI call, no cost, instant response).
  3. Fetch curated official-link resources for the same skill/topic
     from services/resource_repository.py (small, admin-managed,
     independent of focus_band since official docs don't really change
     per skill level).
  4. Return one assembled "Topic Package" — the single object the
     frontend needs to render a learning session.

This is the ONLY service allowed to combine notes + resources — routes
call this, not the two repositories directly, so there's one place that
knows "how a topic page is assembled" instead of that logic leaking into
route handlers.
"""

from firebase.firebase_config import get_firestore_client
from agents.notes_generation_agent import NotesGenerationAgent, NotesGenerationError
from services.notes_repository import get_cached_notes, save_notes
from services.resource_repository import list_resources


class LearningContentError(Exception):
    pass


def get_topic_package(skill: str, topic: str, focus_band: str) -> dict:
    db = get_firestore_client()

    notes = get_cached_notes(db, skill, topic, focus_band)
    was_cached = notes is not None

    if notes is None:
        agent = NotesGenerationAgent()
        try:
            generated = agent.run(skill=skill, topic=topic, focus_band=focus_band)
        except NotesGenerationError as exc:
            raise LearningContentError(
                f"Couldn't generate notes for '{skill} / {topic}' ({focus_band}): {exc}"
            ) from exc
        notes = save_notes(db, skill, topic, focus_band, generated)

    # status="verified" explicitly, not a default in the repository —
    # this is the actual guarantee that a student never sees an
    # AI-suggested resource before a human has checked it (see
    # resource_repository.py's status field docs).
    resources = list_resources(db, skill=skill, topic=topic, status="verified")

    return {
        "skill": skill,
        "topic": topic,
        "focusBand": focus_band,
        "notes": {
            "title": notes["title"],
            "summary": notes["summary"],
            "sections": notes["sections"],
            "codeExample": notes.get("codeExample", ""),
            "keyTakeaways": notes["keyTakeaways"],
        },
        "notesFromCache": was_cached,  # useful for debugging/demoing the caching behavior
        "resources": resources,
    }
