"""
services/question_service.py

Runtime business logic for questions, backing GET /api/questions (and later
GET /api/assessment). This module NEVER touches Excel or pandas — it only
reads Firestore, through services/question_repository.py.

Only Status == "Active" questions are ever returned here. Inactive
(soft-deleted) questions exist in Firestore for audit/history purposes but
must never reach a quiz — that filter lives in question_repository.list_active_questions,
not here, so every future caller (assessment, revision, etc.) inherits it
automatically instead of needing to remember to add it.
"""

from firebase.firebase_config import get_firestore_client
from services.question_repository import list_active_questions


def get_questions(skill: str | None = None) -> list[dict]:
    """
    Return all Active questions, optionally filtered to one Skill
    (e.g. ?skill=Python). No Skill given -> Active questions across all
    skills currently in Firestore.
    """
    db = get_firestore_client()
    return list_active_questions(db, skill=skill)
