"""
services/topic_quiz_service.py

Business logic behind POST-topic quizzes (Objective 3) and the revision
they schedule (Objective 4). Routes (routes/topic_quiz_routes.py) stay
thin — this is where question sourcing, scoring, classification, and
scheduling actually get wired together.

Two entry points, matching the generate/submit split every other quiz
flow in this app uses (see routes/ai_assessment_routes.py):
    get_topic_quiz()      -> GET  /api/topic-quiz/<skill>/<topic>
    submit_topic_quiz()   -> POST /api/topic-quiz/<skill>/<topic>/submit
"""

from firebase.firebase_config import get_firestore_client
from config.settings import settings
from services.question_repository import list_active_questions_by_topic
from services import topic_quiz_repository as repo
from services import topic_quiz_bank_cache as quiz_cache
from services import learner_classifier, revision_scheduler
from agents.topic_quiz_agent import TopicQuizAgent, TopicQuizGenerationError


class TopicQuizError(Exception):
    pass


def get_topic_quiz(uid: str, skill: str, topic: str) -> dict:
    """
    Cache-first, PER STUDENT (uid), not per topic globally — see
    services/topic_quiz_bank_cache.py's module docstring for exactly
    why: this is what makes "accidentally left the page" free (same
    student, same in-progress quiz reused) while keeping "different
    students get different quizzes" and "revision re-tests use fresh
    questions" both true.

    Sourcing priority when generating for the first time (or after a
    prior attempt cleared the cache): admin-curated Question Bank
    first, AI fills only the shortfall. Bank questions and AI questions
    are returned in the SAME shape (QuestionID for bank rows, TempID
    for AI rows) so the frontend doesn't need to know which source each
    came from — it only matters again at submit time.
    """
    db = get_firestore_client()

    cached = quiz_cache.get_cached_quiz(db, uid, skill, topic)
    if cached is not None:
        return {
            "skill": skill, "topic": topic,
            "questions": cached["questions"],
            "totalQuestions": len(cached["questions"]),
            "source": cached["source"],
        }

    needed = settings.TOPIC_QUIZ_QUESTION_COUNT

    bank_questions = list_active_questions_by_topic(db, skill=skill, topic=topic)[:needed]
    shortfall = needed - len(bank_questions)

    ai_questions: list[dict] = []
    if shortfall > 0:
        try:
            ai_questions = TopicQuizAgent().run(skill=skill, topic=topic, count_needed=shortfall)
        except TopicQuizGenerationError as exc:
            if not bank_questions:
                # Nothing to fall back to at all — this is a real failure,
                # not a "smaller quiz than usual" situation. Deliberately
                # NOT cached — a transient generation failure shouldn't be
                # remembered as "this topic has no quiz" forever.
                raise TopicQuizError(str(exc)) from exc
            # Partial bank coverage is still a usable (if shorter) quiz.

    questions = bank_questions + ai_questions
    source = "bank+ai" if (bank_questions and ai_questions) else ("bank" if bank_questions else "ai")

    quiz_cache.save_quiz(db, uid, skill, topic, questions, source)

    return {
        "skill": skill,
        "topic": topic,
        "questions": questions,
        "totalQuestions": len(questions),
        "source": source,
    }


def submit_topic_quiz(
    uid: str,
    skill: str,
    topic: str,
    questions: list[dict],
    answers: dict[str, str],
    time_taken_seconds: int,
) -> dict:
    """
    questions: the exact list returned by get_topic_quiz() (echoed back by
        the frontend, same convention as ai_assessment_routes.py's
        evaluate step) — each has either QuestionID (bank) or TempID (AI).
    answers: {question_id_or_temp_id: chosen_option}.
    """
    if not questions:
        raise TopicQuizError("No questions provided to score.")

    correct = 0
    for q in questions:
        qid = q.get("QuestionID") or q.get("TempID")
        chosen = answers.get(qid)
        if chosen is not None and chosen == q.get("CorrectAnswer"):
            correct += 1

    total = len(questions)
    score_percent = round((correct / total) * 100, 1)

    db = get_firestore_client()
    prior = repo.get_progress(db, uid, skill, topic)
    attempt_number = (prior.get("AttemptCount", 0) if prior else 0) + 1
    prior_avg = prior.get("AverageScorePercent") if prior else None

    result = learner_classifier.classify(
        score_percent=score_percent,
        time_taken_seconds=time_taken_seconds,
        attempt_number=attempt_number,
        prior_average_percent=prior_avg,
    )
    classification = result["classification"]
    next_review_date = revision_scheduler.compute_next_review_date(classification)

    progress = repo.record_attempt(
        db, uid=uid, skill=skill, topic=topic,
        score_percent=score_percent, correct=correct, total=total,
        time_taken_seconds=time_taken_seconds, classification=classification,
        next_review_date=next_review_date,
    )

    # This student has now submitted — clear their cached in-progress
    # quiz so their NEXT open of this topic (their next revision cycle)
    # generates a fresh set of questions instead of replaying the ones
    # they just answered. See topic_quiz_bank_cache.py's module docstring.
    quiz_cache.delete_cached_quiz(db, uid, skill, topic)

    return {
        "scorePercent": score_percent,
        "correct": correct,
        "total": total,
        "classification": classification,
        "classificationProbabilities": result["probabilities"],
        "nextReviewDate": next_review_date,
        "attemptNumber": progress["AttemptNumber"],
        "averageScorePercent": progress["AverageScorePercent"],
    }


def get_due_revisions(uid: str) -> list[dict]:
    db = get_firestore_client()
    return repo.list_due_revisions(db, uid=uid)
