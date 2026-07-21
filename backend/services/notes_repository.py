"""
services/notes_repository.py

The ONLY module that touches the `learning_notes` Firestore collection.
Same dependency-injection pattern as roadmap_repository.py /
assessment_repository.py.

Document ID is a deterministic composite key — skill_topic_focusBand,
slugified — NOT auto-generated, because the whole point is "does a cache
entry already exist for this exact combination", which needs a
predictable lookup key, not a query.

    learning_notes/{skill}__{topic}__{focusBand}
        skill, topic, focusBand, title, summary, sections, codeExample,
        keyTakeaways, generatedAt

This collection is GLOBAL, not per-user — notes for "CSS3 / Flexbox /
fundamentals" are identical for every student at that level, which is
exactly what makes the cache effective (at most 4 entries per topic,
ever, regardless of how many students study it).
"""

import re

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


def _doc_id(skill: str, topic: str, focus_band: str) -> str:
    return f"{_slugify(skill)}__{_slugify(topic)}__{_slugify(focus_band)}"


def get_cached_notes(db, skill: str, topic: str, focus_band: str) -> dict | None:
    """Returns None on a cache miss — caller should generate + save, not treat this as an error."""
    doc_id = _doc_id(skill, topic, focus_band)
    snap = db.collection(settings.LEARNING_NOTES_COLLECTION).document(doc_id).get()
    return snap.to_dict() if snap.exists else None


def save_notes(db, skill: str, topic: str, focus_band: str, notes: dict) -> dict:
    """
    Saves generated notes to the cache. Uses set() (not add()) with the
    deterministic doc ID so a second concurrent generation for the same
    key just overwrites rather than creating a duplicate — acceptable
    here since notes content for a given key should converge to
    essentially the same thing regardless of which request generated it.
    """
    doc_id = _doc_id(skill, topic, focus_band)
    doc_ref = db.collection(settings.LEARNING_NOTES_COLLECTION).document(doc_id)
    payload = {
        "skill": skill,
        "topic": topic,
        "focusBand": focus_band,
        **notes,
        "generatedAt": SERVER_TIMESTAMP,
    }
    doc_ref.set(payload)
    return doc_ref.get().to_dict()
