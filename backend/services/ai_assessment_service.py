"""
services/ai_assessment_service.py

Orchestration layer for AI Agent routes. For this proof-of-concept slice,
it wires the Difficulty Engine and QuestionGenerationAgent. As the
remaining agents in ARCHITECTURE.md are built (Assessment Planner,
Quality Validation, Assessment Builder, ...), this file grows into the
place where they're chained together — routes/ai_assessment_routes.py
should never need to change shape when that happens, only this file.
"""

from agents.question_generation_agent import (
    QuestionGenerationAgent,
    QuestionGenerationError,
)
from firebase.firebase_config import get_firestore_client
from services.difficulty_engine import compute_difficulty, DifficultyDecision
from services.assessment_planner import build_diagnostic_plan
from services.evaluation_service import evaluate_diagnostic_assessment


class AIAssessmentError(Exception):
    pass


def resolve_difficulty(signals: dict) -> DifficultyDecision:
    """
    Runs the Difficulty Engine on raw student performance signals.
    Kept as its own function (not inlined into generate_ai_questions) so
    a future route can call it standalone — e.g. to show "why did I get
    Hard questions?" in the UI before generation even happens.
    """
    return compute_difficulty(
        previous_score=float(signals.get("previous_score", 50)),
        time_taken_seconds=float(signals.get("time_taken_seconds", 0)),
        expected_time_seconds=float(signals.get("expected_time_seconds", 0)),
        confidence=float(signals.get("confidence", 50)),
        mistake_rate=float(signals.get("mistake_rate", 0)),
    )


def generate_ai_questions(
    skill: str,
    topics: list[str],
    count: int,
    difficulty: str | None = None,
    signals: dict | None = None,
    learning_objective: str = "",
) -> dict:
    """
    Runs the Question Generation Agent and returns its output alongside
    the difficulty decision that produced it.

    Exactly one of `difficulty` or `signals` should be provided:
      - `difficulty`: explicit override ("Easy"/"Medium"/"Hard") — used by
        admins/testing, or once the Assessment Planner Agent (§9 Phase 2)
        passes a difficulty it already decided.
      - `signals`: raw student performance data, run through the
        Difficulty Engine to decide difficulty automatically. This is the
        normal path for real assessments.

    Not persisted anywhere — per the architecture rule, AI-generated
    questions are ephemeral until the (future) Assessment Builder Agent
    assembles them into an assessment the student actually takes.
    """
    reasoning = None
    if difficulty:
        pass  # explicit override, no engine involved
    elif signals:
        decision = resolve_difficulty(signals)
        difficulty = decision.difficulty
        reasoning = decision.reasoning
    else:
        raise AIAssessmentError(
            "Provide either 'difficulty' (explicit) or 'signals' "
            "(previous_score, time_taken_seconds, expected_time_seconds, "
            "confidence, mistake_rate) so the Difficulty Engine can decide."
        )

    agent = QuestionGenerationAgent()
    try:
        questions = agent.run(
            topics=topics,
            difficulty=difficulty,
            count=count,
            skill=skill,
            learning_objective=learning_objective,
        )
    except QuestionGenerationError as exc:
        raise AIAssessmentError(str(exc)) from exc

    return {
        "difficulty": difficulty,
        "difficulty_reasoning": reasoning,  # None when explicitly overridden
        "questions": questions,
    }


def generate_diagnostic_assessment(
    skills: list[str], role: str = "", learning_objective: str = ""
) -> dict:
    """
    The real diagnostic assessment: one QuestionGenerationAgent.run_chunked()
    call PER selected skill (via the Assessment Planner's fixed 5 Easy +
    5 Medium + 5 Hard = 15-question plan), aggregated into one question set.

    run_chunked() itself makes 3 smaller Gemini calls per skill (one per
    difficulty, 5 questions each) instead of one 15-question call — see
    agents/question_generation_agent.py and services/assessment_planner.py
    for why: a single big call is more failure-prone, and one skill's
    total failure used to abort the entire diagnostic (5 skills selected
    = 5 chances to crash everything). Chunking shrinks the failure
    surface back down to "one difficulty band of one skill," which
    should now be about as reliable as the old 6-question-total call was.

    Deliberately sequential, not parallel — keeps retry/backoff behavior
    (agents/question_generation_agent.py) simple and predictable, and
    Groq's per-call latency is low enough that even 5-6 skills completes
    well within the frontend's timeout. If this becomes a bottleneck with
    many more skills, parallelizing these calls is a contained change
    right here — nothing else in the stack needs to know.

    Raises AIAssessmentError with a partial-failure message identifying
    which specific skill (and which difficulty chunk within it) failed,
    rather than a generic "something broke".
    """
    plan = build_diagnostic_plan(skills)
    agent = QuestionGenerationAgent()
    all_questions: list[dict] = []

    for skill_plan in plan:
        try:
            questions = agent.run_chunked(
                topics=[skill_plan.skill],
                skill=skill_plan.skill,
                difficulty_counts=skill_plan.difficulty_counts,
                open_ended_counts=skill_plan.open_ended_counts,
                open_ended_type=skill_plan.open_ended_type,
                learning_objective=learning_objective or (f"for the {role} role" if role else ""),
            )
        except QuestionGenerationError as exc:
            raise AIAssessmentError(
                f"Diagnostic assessment generation failed on skill "
                f"'{skill_plan.skill}': {exc}"
            ) from exc

        # CRITICAL: each run_chunked() call numbers its own questions
        # "AI-1".."AI-15" independently — across multiple skills these
        # collide (every skill would have an "AI-1"). Since evaluation
        # matches answers by TempID, colliding IDs silently corrupt
        # scoring (a later skill's answer overwrites an earlier skill's
        # under the same key). Re-namespace by skill right here, once,
        # so every ID in the aggregated set is globally unique.
        for q in questions:
            q["TempID"] = f"{skill_plan.skill}::{q['TempID']}"

        all_questions.extend(questions)

    return {
        "skills": skills,
        "totalQuestions": len(all_questions),
        "questions": all_questions,
    }


def evaluate_assessment(questions: list[dict], answers: dict[str, str]) -> dict:
    """
    Thin wrapper around the Evaluation Agent (services/evaluation_service.py)
    so routes only ever import from ai_assessment_service.py, same as
    every other AI feature — keeps one consistent import surface instead
    of routes reaching into individual agent/service modules directly.
    """
    result = evaluate_diagnostic_assessment(questions, answers)
    return result.to_dict()


def evaluate_and_save_assessment(
    uid: str, role: str, skills: list[str],
    questions: list[dict], answers: dict[str, str],
) -> dict:
    """
    Evaluates AND persists the full result (questions, answers,
    evaluation) so a page refresh loads this saved attempt instead of
    silently generating a brand-new assessment. See
    services/assessment_repository.py for why the FULL result is saved,
    not just the evaluation summary.
    """
    from services.assessment_repository import save_assessment_result

    evaluation = evaluate_assessment(questions, answers)
    db = get_firestore_client()
    save_assessment_result(db, uid, role, skills, questions, answers, evaluation)
    return evaluation


def load_saved_assessment_result(uid: str) -> dict | None:
    """
    Returns the user's last completed assessment (questions, answers,
    evaluation) or None if they haven't completed one yet. None should
    be treated as "show the normal take-the-assessment flow", not an
    error — this is the "don't regenerate on every refresh" fix.
    """
    from services.assessment_repository import get_assessment_result

    db = get_firestore_client()
    return get_assessment_result(db, uid)


def quit_role(uid: str) -> None:
    """
    "Quit Role" (Learning Hub): wipes this student's saved assessment
    AND saved roadmap so Role Selection unlocks again — deliberately
    both, since a leftover roadmap with no matching assessment (or vice
    versa) would leave the app in a half-quit, inconsistent state.
    """
    from services.assessment_repository import delete_assessment_result
    from services.roadmap_repository import delete_roadmap

    db = get_firestore_client()
    delete_assessment_result(db, uid)
    delete_roadmap(db, uid)
