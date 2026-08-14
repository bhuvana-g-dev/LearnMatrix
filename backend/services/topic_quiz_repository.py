"""
services/topic_quiz_repository.py

The ONLY module that touches topic_quiz_attempts and topic_quiz_progress
(see models/topic_quiz_progress_model.py for the doc shapes). Same
dependency-injection convention as question_repository.py — every
function takes `db` rather than fetching it internally, so
services/topic_quiz_service.py, routes/topic_quiz_routes.py, and
scripts/train_learner_classifier.py can all share it.
"""

from datetime import date, timedelta

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


def list_progress_by_uid(db, uid: str) -> list[dict]:
    """Every topic_quiz_progress doc for ONE learner — every topic they've
    ever submitted a quiz for, each carrying its own FocusBand + WeakArea.
    This is what the frontend's buildCourseNavigator.js reads to override
    a topic's skill-level default focus band with the learner's actual,
    per-topic-quiz-derived one once they've taken that topic's quiz."""
    query = _progress_collection(db).where("Uid", "==", uid)
    return [doc.to_dict() for doc in query.stream()]


def list_attempts_by_uid(db, uid: str, limit: int = 500) -> list[dict]:
    """Every topic_quiz_attempts row for ONE learner — a targeted query
    for the admin Student Profile / classification-history view, instead
    of the full-collection scan list_all_attempts() does for classifier
    retraining."""
    query = _attempts_collection(db).where("Uid", "==", uid).limit(limit)
    return [doc.to_dict() for doc in query.stream()]


def list_due_revisions(db, uid: str, as_of: str | None = None) -> list[dict]:
    """Every topic whose NextReviewDate <= as_of (default: today), for the
    dashboard's 'Due Today' card — includes anything overdue too.

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


def list_upcoming_revisions(db, uid: str, days: int = 7, as_of: str | None = None) -> list[dict]:
    """Topics scheduled between tomorrow and (as_of + days) — the 'Upcoming
    Revision Sessions' section on the Revision page. Same composite-index
    note as list_due_revisions() applies here (Uid equality + NextReviewDate
    range) the first time this query runs on a fresh project.
    """
    today = date.fromisoformat(as_of) if as_of else date.today()
    start = (today + timedelta(days=1)).isoformat()
    end = (today + timedelta(days=days)).isoformat()
    query = (
        _progress_collection(db)
        .where("Uid", "==", uid)
        .where("NextReviewDate", ">=", start)
        .where("NextReviewDate", "<=", end)
    )
    return [doc.to_dict() for doc in query.stream()]


def snooze_revision(db, uid: str, skill: str, topic: str) -> dict:
    """Pushes NextReviewDate forward by exactly one day from whatever it
    currently is (not from today) — snoozing a 3-days-overdue topic moves
    it to tomorrow, same as snoozing one due today. Only touches
    NextReviewDate + UpdatedAt; AttemptCount/Classification/scores are
    untouched since no quiz was actually taken.
    """
    doc_id = TopicQuizProgress.doc_id(uid, skill, topic)
    doc_ref = _progress_collection(db).document(doc_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise ValueError("No revision progress found for this topic yet.")

    current = snap.to_dict()
    current_date = date.fromisoformat(current["NextReviewDate"])
    new_date = (current_date + timedelta(days=1)).isoformat()

    doc_ref.update({"NextReviewDate": new_date, "UpdatedAt": SERVER_TIMESTAMP})
    return {**current, "NextReviewDate": new_date}


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
    focus_band: str,
    weak_area: str | None,
    next_review_date: str,
) -> dict:
    """
    Writes TWO things in one call:
      1. An immutable row in topic_quiz_attempts (auto-ID) — the append-only
         history services/learner_classifier.py trains on.
      2. An upsert of topic_quiz_progress/{uid}__{skill}__{topic} — the
         single latest-state doc the dashboard reads.

    focus_band: this attempt's Topic-Mastery-%-derived content level (see
    services/focus_band.py's determine_content_level). weak_area: this
    attempt's weakest difficulty tier (see identify_weak_area). Both
    OVERWRITE any prior value outright (unlike AverageScorePercent,
    which blends with history), since they should reflect what THIS
    topic looks like right now, not an average of an old shaky attempt
    and a since-improved one.

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
        "FocusBand": focus_band,
        "WeakArea": weak_area,
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
        "FocusBand": focus_band,
        "WeakArea": weak_area,
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
