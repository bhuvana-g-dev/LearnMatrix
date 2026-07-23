"""
services/roadmap_repository.py

The ONLY module that touches the `roadmaps` Firestore collection. Same
dependency-injection pattern as services/question_repository.py.

Firestore document layout — ONE document per user (one active roadmap
at a time):

    roadmaps/{uid}
        uid, role, entries: [...] (each tagged status="mastered"|"upcoming"),
        totalSkills, masteredCount, upcomingCount, totalWeeks,
        includesProjectWeek, paceLabel, currentWeek, completionPercent,
        generatedAt, updatedAt

completionPercent is initialized from the Roadmap Agent's own
courseCompletionPercent (mastered skills / total skills) — NOT
hardcoded to 0.0 — because a student who's already Strong in some
skills has genuinely already completed that fraction of the course
before their first "upcoming" week even starts. Completing upcoming
weeks later should push this percentage further (that recompute isn't
built yet — same "topic completion" gap noted before — but the STARTING
value is now honest instead of always zero).

Saving a NEW roadmap (e.g. after a retake) fully REPLACES the previous
one — intentional, matches "regenerate only on retake".
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _doc_ref(db, uid: str):
    return db.collection(settings.ROADMAP_COLLECTION).document(uid)


def save_roadmap(db, uid: str, role: str, roadmap: dict) -> dict:
    """
    `roadmap` is the dict from services/roadmap_service.py's
    Roadmap.to_dict().
    """
    doc_ref = _doc_ref(db, uid)
    existing = doc_ref.get()

    payload = {
        "uid": uid,
        "role": role,
        "entries": roadmap["entries"],
        "totalSkills": roadmap["totalSkills"],
        "masteredCount": roadmap["masteredCount"],
        "upcomingCount": roadmap["upcomingCount"],
        "totalWeeks": roadmap["totalWeeks"],
        "includesProjectWeek": roadmap["includesProjectWeek"],
        "paceLabel": roadmap["paceLabel"],
        "currentWeek": 1,
        "completionPercent": roadmap["courseCompletionPercent"],
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
