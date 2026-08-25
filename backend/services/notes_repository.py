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

import hashlib
import re

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _slugify(value: str) -> str:
    """Lowercase, alphanumeric-and-hyphen only — keeps Firestore doc IDs
    safe regardless of punctuation in a skill/topic name
    (e.g. "React.js" -> "react-js").

    Punctuation characters themselves are dropped (not just collapsed
    to "-") before the hyphen-collapse pass, so two titles that differ
    ONLY in punctuation ("React Hooks!" vs "React Hooks?") no longer
    slugify to the same doc ID — each distinct punctuation mark is
    replaced with a short marker derived from its own ordinal instead
    of disappearing entirely."""
    value = value.strip().lower()
    # Replace runs of non-alphanumeric characters with a hyphen PLUS a
    # short DETERMINISTIC digest of what was actually there (md5, not
    # Python's built-in hash() — hash() is randomized per-process via
    # PYTHONHASHSEED, which would make the same topic slugify
    # differently across requests/workers and silently break the
    # cache), so distinct punctuation produces distinct slugs instead
    # of every run of punctuation collapsing to the same "-".
    def _mark(match: "re.Match") -> str:
        chunk = match.group(0)
        if chunk.isspace():
            return "-"
        digest = hashlib.md5(chunk.encode("utf-8")).hexdigest()[:3]
        return f"-x{digest}-"

    slug = re.sub(r"[^a-z0-9]+", _mark, value)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def _doc_id(skill: str, topic: str, focus_band: str) -> str:
    return f"{_slugify(skill)}__{_slugify(topic)}__{_slugify(focus_band)}"


def notes_cache_key(skill: str, topic: str, focus_band: str) -> str:
    """Public accessor for this cache's doc ID — used as the
    generation-lock key by services/learning_content_service.py so the
    lock and the cache stay keyed identically without duplicating the
    slugify logic elsewhere."""
    return _doc_id(skill, topic, focus_band)


def _doc_ref(db, skill: str, topic: str, focus_band: str):
    doc_id = _doc_id(skill, topic, focus_band)
    return db.collection(settings.LEARNING_NOTES_COLLECTION).document(doc_id)


def get_cached_notes(db, skill: str, topic: str, focus_band: str) -> dict | None:
    """Returns the cached notes dict, or None on a cache miss — None is
    the normal/expected signal to generate now, not an error (see
    services/learning_content_service.py)."""
    snap = _doc_ref(db, skill, topic, focus_band).get()
    return snap.to_dict() if snap.exists else None


def list_all_notes(db, skill: str | None = None, topic: str | None = None) -> list[dict]:
    """
    Every cached notes document — this is the actual reusable/shared
    "System-generated content" the Admin Panel's Generated Content
    Management section shows (see routes/generated_content_routes.py).
    Each doc already carries its own (skill, topic, focusBand) fields
    plus its deterministic doc ID, so no extra bookkeeping collection
    is needed — this repository IS the cache, listing it IS the admin
    view of what's currently being reused.

    skill/topic are optional equality filters, same additive pattern as
    services/resource_repository.py's list_resources().
    """
    docs = db.collection(settings.LEARNING_NOTES_COLLECTION).stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        if skill and data.get("skill") != skill:
            continue
        if topic and data.get("topic") != topic:
            continue
        results.append(data)
    return results


def get_notes_by_id(db, doc_id: str) -> dict | None:
    """Single cached notes doc by its deterministic ID (see _doc_id()) —
    for the Generated Content Management \"View\" action."""
    snap = db.collection(settings.LEARNING_NOTES_COLLECTION).document(doc_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict()
    data["id"] = snap.id
    return data


def delete_notes(db, doc_id: str) -> None:
    """
    Removes one cached notes doc. This is THE control an admin has over
    reused/shared AI-generated content (see services/learning_content_service.py's
    get_topic_package(): a cache miss on the next request for this exact
    (skill, topic, focusBand) regenerates fresh content via
    NotesGenerationAgent and re-caches it under the same doc ID — nothing
    else needs to change for that to happen automatically.
    """
    db.collection(settings.LEARNING_NOTES_COLLECTION).document(doc_id).delete()


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
