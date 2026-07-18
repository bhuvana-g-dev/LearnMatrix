"""
services/roadmap_repository.py

The ONLY module that touches the `roadmaps` Firestore collection. Same
dependency-injection pattern as services/question_repository.py: every
function takes `db` (a Firestore client) as a parameter rather than
fetching it internally, so this stays trivially unit-testable with a
fake client and never hides which caller owns the Firestore connection.

Firestore document layout — ONE document per user (one active roadmap
at a time, matching this iteration's scope; multi-role history is a
later extension, not built here):

    roadmaps/{uid}
        uid, role, entries: [...], alreadyStrong: [...], totalWeeks,
        includesProjectWeek, currentWeek, completionPercent,
        generatedAt, updatedAt

Saving a NEW roadmap (e.g. after a retake) fully REPLACES the previous
one — this is intentional per the product requirement "regenerate only
on retake", not an accidental overwrite. Progress tracking (marking a
week's topic complete, recomputing completionPercent) is intentionally
NOT built here yet — this module currently only supports the "don't
regenerate every page load" requirement; topic-completion tracking is
a separate, larger piece (needs actual learning-content UI to mark
complete from) that ARCHITECTURE.md still lists as unbuilt.
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _doc_ref(db, uid: str):
    return db.collection(settings.ROADMAP_COLLECTION).document(uid)


def save_roadmap(db, uid: str, role: str, roadmap: dict) -> dict:
    """
    Fully replaces any existing roadmap for this user. `roadmap` is the
    dict from services/roadmap_service.py's Roadmap.to_dict() —
    {entries, alreadyStrong, totalWeeks, includesProjectWeek}.

    currentWeek/completionPercent are (re)initialized here since a new
    roadmap means starting over, even if the user had prior progress on
    a different roadmap.
    """
    doc_ref = _doc_ref(db, uid)
    existing = doc_ref.get()

    payload = {
        "uid": uid,
        "role": role,
        "entries": roadmap["entries"],
        "alreadyStrong": roadmap["alreadyStrong"],
        "totalWeeks": roadmap["totalWeeks"],
        "includesProjectWeek": roadmap["includesProjectWeek"],
        "currentWeek": 1,
        "completionPercent": 0.0,
        "updatedAt": SERVER_TIMESTAMP,
    }
    if not existing.exists:
        payload["generatedAt"] = SERVER_TIMESTAMP

    doc_ref.set(payload, merge=False)
    return doc_ref.get().to_dict()


def get_roadmap(db, uid: str) -> dict | None:
    """Returns None if the user has never generated a roadmap yet —
    callers should treat that as "take the assessment first", not an error."""
    snap = _doc_ref(db, uid).get()
    return snap.to_dict() if snap.exists else None
