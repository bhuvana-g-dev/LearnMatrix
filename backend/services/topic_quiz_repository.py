"""
services/topic_quiz_repository.py

The ONLY module that touches topic_quiz_attempts and topic_quiz_progress
(see models/topic_quiz_progress_model.py for the doc shapes). Same
dependency-injection convention as question_repository.py — every
function takes `db` rather than fetching it internally, so
services/topic_quiz_service.py, routes/topic_quiz_routes.py, and
scripts/train_learner_classifier.py can all share it.
"""

from datetime import date

from firebase_admin import firestore

from config.settings import settings
from models.topic_quiz_progress_model import TopicQuizProgress

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _attempts_collection(db):
    return db.collection(settings.TOPIC_QUIZ_ATTEMPTS_COLLECTION)


def _progress_collection(db):
    return db.collection(settings.TOPIC_QUIZ_PROGRESS_COLLECTION)


# ---------------------------------------------------------------------------
# Progress (latest state) — read path
# ---------------------------------------------------------------------------


def get_progress(db, uid: str, skill: str, topic: str) -> dict | None:
    """Current revision state for this learner+topic, or None if they've
    never taken this topic's quiz before (first attempt)."""
    doc_id = TopicQuizProgress.doc_id(uid, skill, topic)
    snap = _progress_collection(db).document(doc_id).get()
    return snap.to_dict() if snap.exists else None


def list_all_progress(db) -> list[dict]:
    """Every topic_quiz_progress doc across all learners — the skill-wise
    latest-classification view services/learner_intelligence_service.py
    reads for the Admin Panel's Learner Intelligence screen. Bounded by
    (students x topics attempted), not raw attempt volume, so a single
    full read here is cheap even at real scale."""
    return [doc.to_dict() for doc in _progress_collection(db).stream()]


def list_attempts_by_uid(db, uid: str, limit: int = 500) -> list[dict]:
    """Every topic_quiz_attempts row for ONE learner — a targeted query
    for the admin Student Profile / classification-history view, instead
    of the full-collection scan list_all_attempts() does for classifier
    retraining."""
    query = _attempts_collection(db).where("Uid", "==", uid).limit(limit)
    return [doc.to_dict() for doc in query.stream()]


def list_due_revisions(db, uid: str, as_of: str | None = None) -> list[dict]:
    """Every topic whose NextReviewDate <= as_of (default: today), for the
    dashboard's 'Due Today' / 'Upcoming Revisions' card.

    NOTE: this is an equality (Uid) + range (NextReviewDate) query — on a
    fresh Firestore project the console may prompt you to create a
    composite index the first time this runs. That's expected; click the
    link in the error/console warning once and it's a one-time setup.
    """
    as_of = as_of or date.today().isoformat()
    query = (
        _progress_collection(db)
        .where("Uid", "==", uid)
        .where("NextReviewDate", "<=", as_of)
    )
    return [doc.to_dict() for doc in query.stream()]


# ---------------------------------------------------------------------------
# Write path
# ---------------------------------------------------------------------------


def record_attempt(
    db,
    uid: str,
    skill: str,
    topic: str,
    score_percent: float,
    correct: int,
    total: int,
    time_taken_seconds: int,
    classification: str,
    next_review_date: str,
) -> dict:
    """
    Writes TWO things in one call:
      1. An immutable row in topic_quiz_attempts (auto-ID) — the append-only
         history services/learner_classifier.py trains on.
      2. An upsert of topic_quiz_progress/{uid}__{skill}__{topic} — the
         single latest-state doc the dashboard reads.

    Returns the updated progress dict.
    """
    prior = get_progress(db, uid, skill, topic)
    prior_attempt_count = prior.get("AttemptCount", 0) if prior else 0
    prior_avg = prior.get("AverageScorePercent", score_percent) if prior else score_percent

    attempt_number = prior_attempt_count + 1
    # Running average — simple incremental mean, no need to re-read the
    # full attempt history just to keep this one summary number current.
    new_avg = round(((prior_avg * prior_attempt_count) + score_percent) / attempt_number, 1)

    _attempts_collection(db).add({
        "Uid": uid,
        "Skill": skill,
        "Topic": topic,
        "ScorePercent": score_percent,
        "Correct": correct,
        "Total": total,
        "TimeTakenSeconds": time_taken_seconds,
        "AttemptNumber": attempt_number,
        "PriorAverageScorePercent": prior_avg,
        "Classification": classification,
        "CreatedAt": SERVER_TIMESTAMP,
    })

    doc_id = TopicQuizProgress.doc_id(uid, skill, topic)
    progress_fields = {
        "Uid": uid,
        "Skill": skill,
        "Topic": topic,
        "AttemptCount": attempt_number,
        "LastScorePercent": score_percent,
        "AverageScorePercent": new_avg,
        "Classification": classification,
        "NextReviewDate": next_review_date,
        "LastAttemptAt": SERVER_TIMESTAMP,
        "UpdatedAt": SERVER_TIMESTAMP,
    }
    doc_ref = _progress_collection(db).document(doc_id)
    if prior is None:
        progress_fields["CreatedAt"] = SERVER_TIMESTAMP
        doc_ref.set(progress_fields)
    else:
        doc_ref.update(progress_fields)

    return {**progress_fields, "AttemptNumber": attempt_number}


# ---------------------------------------------------------------------------
# Training data path — used only by scripts/train_learner_classifier.py
# ---------------------------------------------------------------------------


def list_all_attempts(db, limit: int = 5000) -> list[dict]:
    """Every real attempt recorded so far, oldest-agnostic order. Used to
    retrain services/learner_classifier.py on actual learner data once
    there's enough of it — see that module's cold-start fallback."""
    query = _attempts_collection(db).limit(limit)
    return [doc.to_dict() for doc in query.stream()]
