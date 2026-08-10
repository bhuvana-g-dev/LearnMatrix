"""
services/assessment_repository.py

The ONLY module that touches the `assessment_results` Firestore
collection. Same pattern as services/roadmap_repository.py.

Firestore document layout — ONE document per user (one active/latest
completed assessment; a full history of past attempts is a later
extension, not built here):

    assessment_results/{uid}
        uid, role, skills: [...], questions: [...], answers: {...},
        evaluation: {...}, submittedAt, updatedAt

WHY THIS EXISTS: without it, refreshing the assessment page silently
threw away the student's completed attempt and generated a brand-new
one (a real Gemini/Groq call every refresh, and the original result
just gone). Saving the full result — not just the evaluation summary —
means a reload can show the exact same results screen (skill table +
per-question review) without regenerating anything. Only an explicit
"Take Another Assessment" click should trigger a new attempt.
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _doc_ref(db, uid: str):
    return db.collection(settings.ASSESSMENT_RESULTS_COLLECTION).document(uid)


def save_assessment_result(
    db, uid: str, role: str, skills: list[str],
    questions: list[dict], answers: dict[str, str], evaluation: dict,
) -> dict:
    """
    Fully replaces any previous saved result for this user — a retake
    is meant to overwrite, not accumulate (history/multiple-attempts
    tracking is a later extension).
    """
    doc_ref = _doc_ref(db, uid)
    existing = doc_ref.get()

    payload = {
        "uid": uid,
        "role": role,
        "skills": skills,
        "questions": questions,
        "answers": answers,
        "evaluation": evaluation,
        "updatedAt": SERVER_TIMESTAMP,
    }
    if not existing.exists:
        payload["submittedAt"] = SERVER_TIMESTAMP
    else:
        payload["submittedAt"] = SERVER_TIMESTAMP  # a retake IS a new submission

    doc_ref.set(payload, merge=False)
    return doc_ref.get().to_dict()


def get_assessment_result(db, uid: str) -> dict | None:
    """Returns None if the user has never completed an assessment yet —
    callers should treat that as "show them the normal generate-and-take
    flow", not an error."""
    snap = _doc_ref(db, uid).get()
    return snap.to_dict() if snap.exists else None


def delete_assessment_result(db, uid: str) -> None:
    """
    Removes this user's saved assessment entirely — used by the
    "Quit Role" flow (Learning Hub) so a student who deliberately
    abandons their current role/course is treated as never having
    taken the diagnostic, and Role Selection unlocks again on their
    next visit. Safe to call even if no document exists.
    """
    _doc_ref(db, uid).delete()


def list_all_assessment_results(db) -> list[dict]:
    """
    Every student's saved assessment result — used ONLY by the admin
    Student Records export (services/student_records_service.py), never
    by student-facing routes (those always look up a single uid via
    get_assessment_result). One document per student (see module
    docstring), so this is naturally already deduplicated to each
    student's latest/active attempt.
    """
    return [doc.to_dict() for doc in db.collection(settings.ASSESSMENT_RESULTS_COLLECTION).stream()]
