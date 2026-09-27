"""
services/question_bank_service.py

Two halves of one idea — the `questions` collection doubles as the cache of
everything the AI has generated AND the fallback when the AI is down:

  1. WRITE-THROUGH  save_generated_questions()
     Every diagnostic-assessment chunk that passed the agent's validation is
     saved here (Status=Active, Source="AI"). The Firestore document ID is
     derived from a hash of (skill + question text), so the same question
     generated twice collapses into one document — dedupe needs no read,
     just an atomic create() that is ignored when the ID already exists.
     The save runs on a small background pool so it never adds latency to
     the assessment request (Gunicorn's request timeout is already tight).

  2. FALLBACK       fetch_fallback_chunk()
     When AI generation for one (skill, difficulty) chunk fails after the
     whole provider chain, ai_assessment_service asks for that chunk's
     questions from the bank instead. Returns None unless the bank can fill
     the chunk COMPLETELY (right count per MCQ / open-ended type) — a
     lopsided test would skew the Strong/Intermediate/Weak classification,
     so partial coverage is treated as "no fallback" and the original AI
     error surfaces exactly as before.

Excel-authored questions live in the same collection and are eligible for
the fallback too; they are never touched by the write-through.

Nothing here raises to the caller: a Firestore problem must never turn a
working AI generation into a failure, or mask the original AI error.
"""

import hashlib
import logging
import random
import re
from concurrent.futures import ThreadPoolExecutor

from config.settings import settings
from firebase.firebase_config import get_firestore_client
from services import question_repository as repo

logger = logging.getLogger(__name__)

# Doc-ID prefix for AI rows — kept distinct from the "AI-1" TempIDs that
# only live inside one request, and from hand-authored IDs like "PY001".
AI_ID_PREFIX = "AIQ-"

# Max rows read per (skill, difficulty, type) when sampling a fallback.
FALLBACK_POOL_LIMIT = 100

_save_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="qbank-save")


# ---------------------------------------------------------------------
# Hashing / shape helpers
# ---------------------------------------------------------------------


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def question_hash(skill: str, question_text: str) -> str:
    """Stable dedupe key. Case/whitespace-insensitive; scoped by skill so
    identical wording under two different skills stays two questions."""
    key = f"{_normalize(skill)}|{_normalize(question_text)}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


def _to_bank_fields(q: dict, q_hash: str) -> dict:
    return {
        "Skill": q["Skill"],
        "Topic": q.get("Topic", ""),
        "Difficulty": q["Difficulty"],
        "QuestionType": q.get("QuestionType", "MCQ") or "MCQ",
        "Question": q["Question"],
        "OptionA": q.get("OptionA", ""),
        "OptionB": q.get("OptionB", ""),
        "OptionC": q.get("OptionC", ""),
        "OptionD": q.get("OptionD", ""),
        "CorrectAnswer": q["CorrectAnswer"],
        "Explanation": q.get("Explanation", ""),
        "Status": settings.STATUS_ACTIVE,
        "Source": repo.AI_SOURCE,
        "QuestionHash": q_hash,
    }


def _to_generated_shape(row: dict) -> dict:
    """Bank row -> the same dict shape GeneratedQuestion.to_dict() produces,
    so evaluation / persistence / the frontend can't tell the difference.
    TempID is left blank on purpose: the caller numbers the whole skill's
    questions in one pass. Uses `BankID`, NOT `QuestionID`, for traceability
    — several frontend components key answers on `QuestionID || TempID`."""
    return {
        "TempID": "",
        "Skill": row.get("Skill", ""),
        "Topic": row.get("Topic", "") or "",
        "Difficulty": row.get("Difficulty", ""),
        "QuestionType": row.get("QuestionType", "MCQ") or "MCQ",
        "Question": row.get("Question", ""),
        "OptionA": row.get("OptionA", "") or "",
        "OptionB": row.get("OptionB", "") or "",
        "OptionC": row.get("OptionC", "") or "",
        "OptionD": row.get("OptionD", "") or "",
        "CorrectAnswer": row.get("CorrectAnswer", ""),
        "Explanation": row.get("Explanation", "") or "",
        "Source": "Bank",
        "BankID": row.get("QuestionID", ""),
    }


def _is_usable(row: dict) -> bool:
    """Light sanity check — hand-authored Excel rows aren't validated by the
    AI agent, so don't hand a broken one to a student."""
    if not str(row.get("Question", "")).strip() or not str(row.get("CorrectAnswer", "")).strip():
        return False
    if (row.get("QuestionType") or "MCQ") == "MCQ":
        options = [str(row.get(k, "")).strip() for k in ("OptionA", "OptionB", "OptionC", "OptionD")]
        if not all(options) or len(set(options)) < 4:
            return False
        if row.get("CorrectAnswer") not in ("OptionA", "OptionB", "OptionC", "OptionD"):
            return False
    return True


# ---------------------------------------------------------------------
# 1. Write-through
# ---------------------------------------------------------------------


def _save_batch(questions: list[dict]) -> None:
    try:
        db = get_firestore_client()
    except Exception:  # noqa: BLE001
        logger.exception("Question bank write-through: could not get Firestore client.")
        return

    created = 0
    for q in questions:
        try:
            q_hash = question_hash(q["Skill"], q["Question"])
            if repo.create_question_if_absent(
                db, f"{AI_ID_PREFIX}{q_hash}", _to_bank_fields(q, q_hash)
            ):
                created += 1
        except Exception:  # noqa: BLE001 — one bad row must not block the rest
            logger.exception("Question bank write-through: failed to save one question.")
    logger.info(
        "Question bank write-through: %d new, %d duplicate/skipped.",
        created, len(questions) - created,
    )


def save_generated_questions(questions: list[dict]) -> None:
    """Fire-and-forget. Pass validated GeneratedQuestion dicts. Copies each
    dict first because the caller keeps mutating them (TempID renumbering)
    while the background save is still pending."""
    if not questions:
        return
    try:
        _save_pool.submit(_save_batch, [dict(q) for q in questions])
    except Exception:  # noqa: BLE001
        logger.exception("Question bank write-through: could not queue save.")


# ---------------------------------------------------------------------
# 2. Fallback
# ---------------------------------------------------------------------


def fetch_fallback_chunk(
    skill: str,
    difficulty: str,
    mcq_count: int,
    open_count: int,
    open_ended_type: str,
) -> list[dict] | None:
    """
    Random sample matching one chunk of the assessment plan exactly:
    mcq_count MCQ + open_count of open_ended_type, all at `difficulty`.
    Returns None if the bank can't cover BOTH parts (or on any Firestore
    error) — the caller then re-raises the original AI failure.
    """
    try:
        db = get_firestore_client()
        picked: list[dict] = []
        for q_type, needed in (("MCQ", mcq_count), (open_ended_type, open_count)):
            if needed <= 0:
                continue
            pool = [
                row for row in repo.list_active_for_fallback(
                    db, skill, difficulty, q_type, FALLBACK_POOL_LIMIT
                )
                if _is_usable(row)
            ]
            if len(pool) < needed:
                logger.warning(
                    "Question bank fallback: %s/%s has %d usable %s, need %d.",
                    skill, difficulty, len(pool), q_type, needed,
                )
                return None
            picked.extend(random.sample(pool, needed))
        return [_to_generated_shape(row) for row in picked]
    except Exception:  # noqa: BLE001
        logger.exception("Question bank fallback failed for %s/%s.", skill, difficulty)
        return None
