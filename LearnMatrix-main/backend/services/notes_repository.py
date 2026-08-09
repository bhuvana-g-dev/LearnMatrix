"""
services/notes_repository.py

The ONLY module that touches the `learning_notes` Firestore collection.
Same dependency-injection pattern as services/question_repository.py
and services/resource_repository.py.

Notes are cached per (skill, topic, focusBand) — generated once by
agents/notes_generation_agent.py, reused by every student who reaches
that exact skill/topic/level after that, never regenerated per-request
(see services/learning_content_service.py for the cache-check-then-
generate orchestration this repository is called from).

Doc ID is a deterministic slug built from (skill, topic, focus_band) —
not an auto-generated ID — specifically so a cache lookup is a single
direct .get() by ID instead of a filtered query. This is what makes
"check cache, skip the AI call entirely on a hit" cheap and instant.

    learning_notes/{skill}__{topic}__{focusBand}  (slugified)
        skill, topic, focusBand, title, summary, sections: [...],
        codeExample, keyTakeaways: [...], generatedAt
"""

import re

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _slugify(value: str) -> str:
    """Lowercase, alphanumeric-and-hyphen only — keeps Firestore doc IDs
    safe regardless of punctuation in a skill/topic name
    (e.g. "React.js" -> "react-js")."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return slug.strip("-")


def _doc_id(skill: str, topic: str, focus_band: str) -> str:
    return f"{_slugify(skill)}__{_slugify(topic)}__{_slugify(focus_band)}"


def _doc_ref(db, skill: str, topic: str, focus_band: str):
    doc_id = _doc_id(skill, topic, focus_band)
    return db.collection(settings.LEARNING_NOTES_COLLECTION).document(doc_id)


def get_cached_notes(db, skill: str, topic: str, focus_band: str) -> dict | None:
    """Returns the cached notes dict, or None on a cache miss — None is
    the normal/expected signal to generate now, not an error (see
    services/learning_content_service.py)."""
    snap = _doc_ref(db, skill, topic, focus_band).get()
    return snap.to_dict() if snap.exists else None


def save_notes(db, skill: str, topic: str, focus_band: str, notes: dict) -> dict:
    """
    `notes` is the raw dict returned by
    agents/notes_generation_agent.py's NotesGenerationAgent.run() —
    already validated there (title, summary, sections, keyTakeaways
    required; codeExample optional).
    """
    doc_ref = _doc_ref(db, skill, topic, focus_band)
    payload = {
        "skill": skill,
        "topic": topic,
        "focusBand": focus_band,
        "title": notes["title"],
        "summary": notes["summary"],
        "sections": notes["sections"],
        "codeExample": notes.get("codeExample", ""),
        "keyTakeaways": notes["keyTakeaways"],
        "generatedAt": SERVER_TIMESTAMP,
    }
    doc_ref.set(payload)
    return doc_ref.get().to_dict()
