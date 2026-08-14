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
from services import topic_quiz_repository as repo
from services import topic_quiz_bank_cache as quiz_cache
from services import learner_classifier, revision_scheduler
from services.focus_band import determine_focus_band
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

    AI-only on a cache miss — no admin Question Bank fallback. Every
    learner gets a freshly AI-generated quiz; nothing is ever served
    from a shared bank across students. Each freshly generated question
    is logged (not cached/served back) via
    services/topic_quiz_repository.log_generated_questions for the
    Admin Panel's AI Questions screen.
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

    try:
        questions = TopicQuizAgent().run(skill=skill, topic=topic, count_needed=needed)
    except TopicQuizGenerationError as exc:
        # Deliberately NOT cached — a transient generation failure
        # shouldn't be remembered as "this topic has no quiz" forever.
        raise TopicQuizError(str(exc)) from exc

    source = "ai"
    quiz_cache.save_quiz(db, uid, skill, topic, questions, source)

    try:
        repo.log_generated_questions(db, [
            {
                "Uid": uid,
                "Skill": skill,
                "Topic": topic,
                "Difficulty": q.get("Difficulty"),
                "Question": q.get("Question"),
                "CorrectAnswer": q.get("CorrectAnswer"),
                "Explanation": q.get("Explanation"),
                "AiModel": settings.GEMINI_MODEL,
                "CreatedAt": repo.SERVER_TIMESTAMP,
            }
            for q in questions
        ])
    except Exception:  # noqa: BLE001 — a logging failure must never fail the student's quiz
        pass

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
        evaluate step) — every question is AI-generated and carries a
        TempID (see agents/topic_quiz_agent.py).
    answers: {temp_id: chosen_option}.
    """
    if not questions:
        raise TopicQuizError("No questions provided to score.")

    correct = 0
    # Easy/Medium/Hard breakdown for THIS attempt — same shape
    # services/roadmap_service.py builds from the diagnostic assessment,
    # here built from the topic quiz's own questions (TopicQuizAgent
    # tags every question, bank or AI, with a Difficulty). Feeds
    # determine_focus_band() below so content depth reflects how THIS
    # topic quiz actually went, not the whole-skill diagnostic.
    breakdown = {
        "Easy": {"correct": 0, "total": 0},
        "Medium": {"correct": 0, "total": 0},
        "Hard": {"correct": 0, "total": 0},
    }
    for q in questions:
        qid = q.get("TempID")
        chosen = answers.get(qid)
        is_correct = chosen is not None and chosen == q.get("CorrectAnswer")
        if is_correct:
            correct += 1

        difficulty = q.get("Difficulty")
        if difficulty in breakdown:
            breakdown[difficulty]["total"] += 1
            if is_correct:
                breakdown[difficulty]["correct"] += 1

    total = len(questions)
    score_percent = round((correct / total) * 100, 1)
    focus_band = determine_focus_band(breakdown)

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
        focus_band=focus_band, next_review_date=next_review_date,
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
        "focusBand": focus_band,
        "nextReviewDate": next_review_date,
        "attemptNumber": progress["AttemptNumber"],
        "averageScorePercent": progress["AverageScorePercent"],
    }


def get_due_revisions(uid: str) -> dict:
    db = get_firestore_client()
    return {
        "due": repo.list_due_revisions(db, uid=uid),
        "upcoming": repo.list_upcoming_revisions(db, uid=uid, days=7),
    }


def get_topic_progress(uid: str) -> list[dict]:
    """Every topic this learner has ever submitted a quiz for, each with
    its own FocusBand/Classification — see routes/topic_quiz_routes.py's
    GET /api/topic-quiz/<uid>/progress. Consumed by the frontend once,
    on Course Workspace load, to override skill-level default focus
    bands with the learner's real per-topic-quiz results."""
    db = get_firestore_client()
    return repo.list_progress_by_uid(db, uid=uid)


def snooze_topic_revision(uid: str, skill: str, topic: str) -> dict:
    db = get_firestore_client()
    try:
        return repo.snooze_revision(db, uid=uid, skill=skill, topic=topic)
    except ValueError as exc:
        raise TopicQuizError(str(exc)) from exc
