"""
services/learner_intelligence_service.py

Admin-only. Turns the two collections services/topic_quiz_repository.py
already owns — topic_quiz_progress (latest classification per learner
per topic) and topic_quiz_attempts (the immutable history those
classifications came from) — into the two views the Admin Panel's
Learner Intelligence screens need:

    list_learners()       -> filterable table, one row per
                              (learner, skill, topic). Backs the
                              Learner Intelligence search screen.
    get_student_profile() -> one learner's full skill-wise breakdown,
                              WHY each classification happened, and
                              their attempt history. Backs the Student
                              Profile screen.

No new Firestore collection: topic_quiz_progress + topic_quiz_attempts
ARE the learner_profile / learner_classification_history data the spec
describes — this only adds a read/aggregation layer on top of them, per
"reuse existing Firestore collections/services wherever possible."

The "why was this student classified Fast/Moderate/Slow" requirement is
met by re-running services/learner_classifier.classify() on an
attempt's own stored features — the admin sees the actual model output
for that attempt, not a re-derived guess at its logic.
"""

from collections import defaultdict

from firebase.firebase_config import get_firestore_client
from services import topic_quiz_repository as repo
from services import learner_classifier
from utils.auth_lookup import email_for_uid, uid_for_email


def _reasoning_for_attempt(attempt: dict) -> dict:
    """Re-classifies this attempt from its own stored features so the
    returned reasoning/probabilities are the real model output for that
    attempt, not a re-implementation of its thresholds."""
    score = attempt.get("ScorePercent", 0)
    time_taken = attempt.get("TimeTakenSeconds", 0)
    attempt_number = attempt.get("AttemptNumber", 1)
    prior_avg = attempt.get("PriorAverageScorePercent", score)

    result = learner_classifier.classify(
        score_percent=score,
        time_taken_seconds=time_taken,
        attempt_number=attempt_number,
        prior_average_percent=prior_avg,
    )

    if score > prior_avg:
        trend_phrase = f"above their {prior_avg}% running average"
    elif score < prior_avg:
        trend_phrase = f"below their {prior_avg}% running average"
    else:
        trend_phrase = f"in line with their {prior_avg}% running average"

    reasoning = (
        f"Scored {score}% on attempt #{attempt_number} ({time_taken}s taken), "
        f"{trend_phrase} -> classified {result['classification']}."
    )

    return {
        "classification": result["classification"],
        "probabilities": result["probabilities"],
        "reasoning": reasoning,
    }


def _group_attempts_by_uid_skill_topic(attempts: list[dict]) -> dict[tuple, list[dict]]:
    grouped = defaultdict(list)
    for a in attempts:
        key = (a.get("Uid"), a.get("Skill"), a.get("Topic"))
        grouped[key].append(a)
    for key, rows in grouped.items():
        rows.sort(key=lambda a: a.get("AttemptNumber") or 0)
    return grouped


def list_learners(
    email: str | None = None,
    skill: str | None = None,
    topic: str | None = None,
    learner_type: str | None = None,
) -> list[dict]:
    """One row per (learner, skill, topic) — the Learner Intelligence
    table. Every filter is applied server-side so the frontend only ever
    receives the rows the admin actually asked to see."""
    db = get_firestore_client()

    target_uid = None
    if email:
        target_uid = uid_for_email(email)
        if not target_uid:
            return []

    progress_rows = repo.list_all_progress(db)
    if target_uid:
        progress_rows = [p for p in progress_rows if p.get("Uid") == target_uid]
    if skill:
        progress_rows = [p for p in progress_rows if p.get("Skill") == skill]
    if topic:
        progress_rows = [p for p in progress_rows if p.get("Topic") == topic]
    if learner_type:
        progress_rows = [p for p in progress_rows if p.get("Classification") == learner_type]

    if not progress_rows:
        return []

    # Response time needs the attempt history: a single targeted query
    # when the search is scoped to one learner, otherwise the same
    # bounded full-collection read services/learner_classifier.py's
    # retrain script already relies on.
    attempts = repo.list_attempts_by_uid(db, target_uid) if target_uid else repo.list_all_attempts(db)
    grouped_attempts = _group_attempts_by_uid_skill_topic(attempts)

    email_cache: dict[str, str] = {}

    def _cached_email(uid: str) -> str:
        if uid not in email_cache:
            email_cache[uid] = email_for_uid(uid)
        return email_cache[uid]

    rows = []
    for p in progress_rows:
        uid, s, t = p.get("Uid"), p.get("Skill"), p.get("Topic")
        key_attempts = grouped_attempts.get((uid, s, t), [])
        times = [a.get("TimeTakenSeconds") for a in key_attempts if a.get("TimeTakenSeconds") is not None]
        avg_response_seconds = round(sum(times) / len(times), 1) if times else None

        avg_score = p.get("AverageScorePercent")
        last_score = p.get("LastScorePercent")
        improvement = (
            round(last_score - avg_score, 1) if (last_score is not None and avg_score is not None) else None
        )
        attempt_count = p.get("AttemptCount") or 0

        rows.append({
            "uid": uid,
            "email": _cached_email(uid),
            "skill": s,
            "topic": t,
            "learnerType": p.get("Classification"),
            "accuracyPercent": avg_score,
            "lastScorePercent": last_score,
            "attemptCount": attempt_count,
            "avgResponseTimeSeconds": avg_response_seconds,
            "improvement": improvement,
            "needsReinforcement": p.get("Classification") == "Slow" and attempt_count >= 2,
            "nextReviewDate": p.get("NextReviewDate"),
            "lastAttemptAt": p.get("LastAttemptAt"),
        })

    rows.sort(key=lambda r: (r["email"], r["skill"], r["topic"]))
    return rows


def get_student_profile(email: str) -> dict | None:
    """Full picture for ONE learner: overall type, skill-wise types each
    with WHY they were classified that way, weak topics, and the raw
    attempt/classification history behind each. Returns None when the
    email doesn't resolve to a real Firebase Auth user."""
    db = get_firestore_client()
    uid = uid_for_email(email)
    if not uid:
        return None

    progress_rows = [p for p in repo.list_all_progress(db) if p.get("Uid") == uid]
    attempts = repo.list_attempts_by_uid(db, uid)
    grouped_attempts = _group_attempts_by_uid_skill_topic(attempts)

    skills = []
    type_counts: dict[str, int] = defaultdict(int)

    for p in progress_rows:
        s, t = p.get("Skill"), p.get("Topic")
        key_attempts = grouped_attempts.get((uid, s, t), [])
        latest_attempt = key_attempts[-1] if key_attempts else None
        why = _reasoning_for_attempt(latest_attempt) if latest_attempt else None

        classification = p.get("Classification")
        if classification:
            type_counts[classification] += 1

        skills.append({
            "skill": s,
            "topic": t,
            "learnerType": classification,
            "accuracyPercent": p.get("AverageScorePercent"),
            "lastScorePercent": p.get("LastScorePercent"),
            "attemptCount": p.get("AttemptCount"),
            "nextReviewDate": p.get("NextReviewDate"),
            "why": why["reasoning"] if why else "No attempts recorded yet.",
            "probabilities": why["probabilities"] if why else None,
            "history": [
                {
                    "attemptNumber": a.get("AttemptNumber"),
                    "scorePercent": a.get("ScorePercent"),
                    "classification": a.get("Classification"),
                    "timeTakenSeconds": a.get("TimeTakenSeconds"),
                    "createdAt": a.get("CreatedAt"),
                }
                for a in key_attempts
            ],
        })

    skills.sort(key=lambda s: (s["skill"] or "", s["topic"] or ""))
    # Overall type = the classification this learner most often carries
    # right now across their skills — a transparent aggregate of real
    # per-skill values, not a separately invented number.
    overall_type = max(type_counts, key=type_counts.get) if type_counts else None
    weak_topics = [{"skill": sk["skill"], "topic": sk["topic"]} for sk in skills if sk["learnerType"] == "Slow"]

    return {
        "uid": uid,
        "email": email,
        "overallLearnerType": overall_type,
        "skills": skills,
        "weakTopics": weak_topics,
    }
