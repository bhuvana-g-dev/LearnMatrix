"""
services/admin_question_service.py

Business logic backing the Admin Panel's Question Bank
(routes/admin_question_routes.py). This is the ONLY new service added for
the admin module — it deliberately does not duplicate Firestore access:
every read/write call goes through services/question_repository.py, the
same module the student-facing API and the Excel upload script already use.

Responsibilities:
  - List/search/filter questions (including Inactive ones — admins need to
    see soft-deleted questions, unlike the student-facing API).
  - Validate + create a new question.
  - Validate + update an existing question.
  - Soft-delete / reactivate a question (Status flip only, never a real
    delete — enforced here by only ever calling repository.set_status).
"""

from firebase.firebase_config import get_firestore_client
from models.question_model import Question
from config.settings import settings
from services.question_repository import (
    list_all_questions,
    get_question_by_id,
    question_exists,
    upsert_question,
    set_status,
)


class AdminQuestionError(Exception):
    """Raised for validation/not-found problems in the admin question flow."""


def _validate_required_fields(payload: dict) -> None:
    missing = [
        field
        for field in settings.ADMIN_REQUIRED_QUESTION_FIELDS
        if not str(payload.get(field, "")).strip()
    ]
    if missing:
        raise AdminQuestionError(f"Missing required field(s): {missing}")


def get_questions_for_admin(
    skill: str | None = None,
    role: str | None = None,
    difficulty: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> list[dict]:
    """
    Every question (any Status) matching the given equality filters, then
    narrowed further by a case-insensitive substring match of `search`
    against QuestionID/Question/Skill/Role — done in Python since Firestore
    cannot do substring queries.
    """
    db = get_firestore_client()
    questions = list_all_questions(
        db, skill=skill, role=role, difficulty=difficulty, status=status
    )

    if search:
        needle = search.strip().lower()
        questions = [
            q
            for q in questions
            if needle in str(q.get("QuestionID", "")).lower()
            or needle in str(q.get("Question", "")).lower()
            or needle in str(q.get("Skill", "")).lower()
            or needle in str(q.get("Role", "")).lower()
        ]

    questions.sort(key=lambda q: str(q.get("QuestionID", "")))
    return questions


def create_question(payload: dict) -> dict:
    """Create a brand-new question. Rejects a QuestionID that already exists —
    use update_question() to edit an existing one."""
    _validate_required_fields(payload)
    db = get_firestore_client()

    question_id = str(payload["QuestionID"]).strip()
    if question_exists(db, question_id):
        raise AdminQuestionError(
            f"QuestionID '{question_id}' already exists. Use edit instead."
        )

    question = Question.from_admin_payload(payload)
    upsert_question(db, question.to_upload_dict())
    return get_question_by_id(db, question_id)


def update_question(question_id: str, payload: dict) -> dict:
    """Update an existing question in place. QuestionID in the URL wins —
    it is never changed by the body, since it's the permanent Firestore key."""
    payload = {**payload, "QuestionID": question_id}
    _validate_required_fields(payload)
    db = get_firestore_client()

    if not question_exists(db, question_id):
        raise AdminQuestionError(f"QuestionID '{question_id}' not found.")

    question = Question.from_admin_payload(payload)
    upsert_question(db, question.to_upload_dict())
    return get_question_by_id(db, question_id)


def set_question_status(question_id: str, status: str) -> dict:
    """Soft-delete (Status=Inactive) or reactivate (Status=Active) a question.
    Never removes the Firestore document."""
    valid_statuses = {settings.STATUS_ACTIVE, settings.STATUS_INACTIVE}
    if status not in valid_statuses:
        raise AdminQuestionError(
            f"Status must be one of {sorted(valid_statuses)}, got '{status}'."
        )

    db = get_firestore_client()
    if not question_exists(db, question_id):
        raise AdminQuestionError(f"QuestionID '{question_id}' not found.")

    set_status(db, question_id, status)
    return get_question_by_id(db, question_id)
