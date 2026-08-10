"""
services/roadmap_repository.py

The ONLY module that touches the `roadmaps` Firestore collection. Same
dependency-injection pattern as services/question_repository.py.

Firestore document layout — ONE document per user (one active roadmap
at a time):

    roadmaps/{uid}
        uid, role, roleId, entries: [...] (each tagged
        status="mastered"|"upcoming"|"not_assessed"),
        totalSkills, masteredCount, upcomingCount, notAssessedCount,
        totalWeeks, includesProjectWeek, paceLabel, currentWeek,
        completionPercent, courseCompletionPercent, compressedSyllabus,
        generatedAt, updatedAt

roleId + compressedSyllabus (services/syllabus_compression_service.py's
get_compressed_role_syllabus output) are persisted alongside the
roadmap itself so the frontend's topic-level expand view
(RoadmapDisplay.jsx) loads from this ONE document instead of a second
live call on every page open. Both are None when role_id wasn't
resolvable (services/roadmap_service.resolve_role_skills) — same
"silently fall back, never error" rule as the rest of the role-driven
path.

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


def save_roadmap(
    db, uid: str, role: str, roadmap: dict,
    role_id: str | None = None, compressed_syllabus: dict | None = None,
) -> dict:
    """
    `roadmap` is the dict from services/roadmap_service.py's
    Roadmap.to_dict(). `role_id` and `compressed_syllabus` are optional
    — both None when the role wasn't resolvable (role not seeded yet),
    in which case the roadmap still saves fine, just without the
    topic-level expand data.
    """
    doc_ref = _doc_ref(db, uid)
    existing = doc_ref.get()

    payload = {
        "uid": uid,
        "role": role,
        "roleId": role_id,
        "entries": roadmap["entries"],
        "totalSkills": roadmap["totalSkills"],
        "masteredCount": roadmap["masteredCount"],
        "upcomingCount": roadmap["upcomingCount"],
        "notAssessedCount": roadmap.get("notAssessedCount", 0),
        "totalWeeks": roadmap["totalWeeks"],
        "includesProjectWeek": roadmap["includesProjectWeek"],
        "paceLabel": roadmap["paceLabel"],
        "currentWeek": 1,
        "completionPercent": roadmap["courseCompletionPercent"],
        "courseCompletionPercent": roadmap["courseCompletionPercent"],
        "moduleOrder": roadmap.get("moduleOrder", []),
        "compressedSyllabus": compressed_syllabus,
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


def delete_roadmap(db, uid: str) -> None:
    """
    Removes this user's saved roadmap entirely — paired with
    delete_assessment_result() by the "Quit Role" flow. Safe to call
    even if no document exists.
    """
    _doc_ref(db, uid).delete()


def list_all_roadmaps(db) -> list[dict]:
    """Every student's saved roadmap — used ONLY by the admin Student
    Records export (services/student_records_service.py), never by
    student-facing routes (those always look up a single uid via
    get_roadmap)."""
    return [doc.to_dict() for doc in db.collection(settings.ROADMAP_COLLECTION).stream()]
