"""
services/question_repository.py

The ONLY module that touches the `questions` Firestore collection. Both the
runtime read path (services/question_service.py, for the Flask API) and the
write path (scripts/upload_questions.py, for Excel imports) go through here.
Centralizing this means the upsert/soft-delete/timestamp rules are defined
exactly once, not duplicated between "the script that writes" and
"the service that reads."

Firestore document layout:
    questions/{QuestionID}
        QuestionID, Skill, Topic, Difficulty, QuestionType, Question,
        OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation,
        Status, CreatedAt, UpdatedAt

Every function here takes `db` (a Firestore client) as a parameter rather
than fetching it internally. That's a deliberate dependency-injection
choice: it lets both the Flask app and the standalone CLI script share this
module without either one hardcoding how the client is obtained, and makes
the functions trivially unit-testable with a fake client.
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _collection(db):
    return db.collection(settings.QUESTIONS_COLLECTION)


# ---------------------------------------------------------------------------
# Read path — used by services/question_service.py (Flask API, runtime).
# ---------------------------------------------------------------------------


def list_active_questions(db, skill: str | None = None) -> list[dict]:
    """
    Return every question with Status == Active, optionally filtered to one
    Skill. This is the ONLY read function the quiz-facing API should call —
    Inactive questions must never reach GET /questions or GET /assessment.
    """
    query = _collection(db).where("Status", "==", settings.STATUS_ACTIVE)
    if skill:
        query = query.where("Skill", "==", skill)

    return [doc.to_dict() for doc in query.stream()]


def list_active_questions_by_topic(db, skill: str, topic: str) -> list[dict]:
    """Active questions for one exact Skill+Topic pair — what
    services/topic_quiz_service.py reads first before falling back to AI
    generation (same hybrid-priority pattern as
    services/youtube_service.py: admin-curated bank first, AI fills the
    gap only when the bank doesn't have enough)."""
    query = (
        _collection(db)
        .where("Status", "==", settings.STATUS_ACTIVE)
        .where("Skill", "==", skill)
        .where("Topic", "==", topic)
    )
    return [doc.to_dict() for doc in query.stream()]


def list_distinct_skills(db) -> list[str]:
    """Active skills currently present in Firestore (for a /skills-style listing)."""
    docs = _collection(db).where("Status", "==", settings.STATUS_ACTIVE).stream()
    return sorted({doc.to_dict().get("Skill") for doc in docs if doc.to_dict().get("Skill")})


# ---------------------------------------------------------------------------
# Admin read path — used by services/admin_question_service.py
# (Admin Panel: GET /api/admin/questions). Unlike list_active_questions,
# this deliberately returns every Status so the Question Bank screen can
# show Inactive (soft-deleted) rows too.
# ---------------------------------------------------------------------------


def list_all_questions(
    db,
    skill: str | None = None,
    difficulty: str | None = None,
    status: str | None = None,
) -> list[dict]:
    """
    Return every question document, regardless of Status, optionally
    narrowed by equality filters. Free-text `search` is intentionally NOT
    handled here — Firestore has no substring query, so
    services/admin_question_service.py applies that filter in Python on
    the result of this function.
    """
    query = _collection(db)
    if skill:
        query = query.where("Skill", "==", skill)
    if difficulty:
        query = query.where("Difficulty", "==", difficulty)
    if status:
        query = query.where("Status", "==", status)

    return [doc.to_dict() for doc in query.stream()]


def get_question_by_id(db, question_id: str) -> dict | None:
    """Single question document by QuestionID, or None if it doesn't exist."""
    doc = _collection(db).document(question_id).get()
    return doc.to_dict() if doc.exists else None


def question_exists(db, question_id: str) -> bool:
    return _collection(db).document(question_id).get().exists


# ---------------------------------------------------------------------------
# Write path — used by scripts/upload_questions.py (Excel import) AND by
# services/admin_question_service.py (Admin Panel create/edit/soft-delete).
# Both callers share the exact same upsert_question/set_status functions on
# purpose, so "how a question gets written" is defined exactly once.
# ---------------------------------------------------------------------------


def get_existing_ids_for_skill(db, skill: str) -> set[str]:
    """
    All QuestionIDs currently in Firestore for a given Skill, regardless of
    Status. Used by the upload script to detect which rows disappeared from
    the Excel file (candidates for soft delete).
    """
    docs = _collection(db).where("Skill", "==", skill).stream()
    return {doc.id for doc in docs}


def upsert_question(db, question_dict: dict) -> str:
    """
    Insert-or-update a single question, keyed by QuestionID.

    - New QuestionID  -> create document, CreatedAt = UpdatedAt = now.
    - Existing QuestionID -> update document, CreatedAt untouched,
      UpdatedAt = now.

    Returns "created" or "updated" so the calling script can report a
    per-row summary.
    """
    question_id = question_dict["QuestionID"]
    doc_ref = _collection(db).document(question_id)
    existing = doc_ref.get()

    fields = {k: v for k, v in question_dict.items() if k != "QuestionID"}
    fields["QuestionID"] = question_id
    fields["UpdatedAt"] = SERVER_TIMESTAMP

    if existing.exists:
        doc_ref.update(fields)
        return "updated"

    fields["CreatedAt"] = SERVER_TIMESTAMP
    doc_ref.set(fields)
    return "created"


def set_status(db, question_id: str, status: str) -> None:
    """
    Soft-delete / reactivate a single document by QuestionID. Never removes
    the document — only flips Status and refreshes UpdatedAt.
    """
    doc_ref = _collection(db).document(question_id)
    doc_ref.update({"Status": status, "UpdatedAt": SERVER_TIMESTAMP})


def deactivate_missing_questions(
    db, skill: str, ids_present_in_excel: set[str]
) -> list[str]:
    """
    For a given Skill, soft-delete every Firestore document whose
    QuestionID is NOT present in the latest Excel upload for that skill.
    Documents are never deleted — only their Status flips to Inactive.

    Returns the list of QuestionIDs that were deactivated this run.
    """
    existing_ids = get_existing_ids_for_skill(db, skill)
    missing_ids = existing_ids - ids_present_in_excel

    for question_id in missing_ids:
        set_status(db, question_id, settings.STATUS_INACTIVE)

    return sorted(missing_ids)
