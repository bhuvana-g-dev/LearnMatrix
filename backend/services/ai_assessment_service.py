"""
services/ai_assessment_service.py

Orchestration layer for AI Agent routes. For this proof-of-concept slice,
it wires the Difficulty Engine and QuestionGenerationAgent. As the
remaining agents in ARCHITECTURE.md are built (Assessment Planner,
Quality Validation, Assessment Builder, ...), this file grows into the
place where they're chained together — routes/ai_assessment_routes.py
should never need to change shape when that happens, only this file.
"""

import concurrent.futures
import time

from agents.question_generation_agent import (
    QuestionGenerationAgent,
    QuestionGenerationError,
)
from config.settings import settings
from firebase.firebase_config import get_firestore_client
from services.difficulty_engine import compute_difficulty, DifficultyDecision
from services.assessment_planner import build_diagnostic_plan, SkillPlan
from services import question_bank_service
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

    Skills run CONCURRENTLY now (up to settings.AI_ASSESSMENT_MAX_PARALLEL_SKILLS
    at once via a thread pool), not one after another — with 15
    questions/skill via 3 sequential chunk calls each, a fully sequential
    multi-skill assessment was slow enough to trip Gunicorn's request
    timeout on Render (each worker gets killed mid-request past its
    configured --timeout, logged as a confusing "SIGKILL, perhaps out of
    memory" even though the real cause is just wall-clock time). Running
    skills in parallel cuts total wait roughly by the number of skills,
    up to the concurrency cap. Each skill's own 3 chunks still run
    sequentially with a small delay between them (see run_chunked) — that
    spacing is about not bursting ONE skill's key/quota, which parallel
    OTHER skills doesn't change.

    Every skill's call is submitted before any result is inspected, and
    concurrent.futures.wait() blocks until all of them have finished
    (successfully or not) — so a fast-failing skill doesn't get reported
    while a slower skill is still legitimately mid-call. Results are then
    read back out in the ORIGINAL skill order (not completion order), so
    the output and any error message stay deterministic regardless of
    which thread happened to finish first.

    Question bank: each difficulty chunk is generated on its own (see
    _generate_skill_questions). A chunk that passes validation is saved to
    the bank (write-through); a chunk that still fails after every provider
    and retry is filled from the bank instead, if the bank can cover it
    completely. Only when the bank can't either does the original failure
    surface as before. The result's "source" is "ai" / "bank" / "mixed",
    and "fallbackChunks" lists which (skill, difficulty) chunks came from
    the bank; each question also carries its own Source ("AI" / "Bank").

    Raises AIAssessmentError with a partial-failure message identifying
    which specific skill (and which difficulty chunk within it) failed,
    rather than a generic "something broke".
    """
    plan = build_diagnostic_plan(skills)
    agent = QuestionGenerationAgent()

    max_workers = max(1, min(len(plan), settings.AI_ASSESSMENT_MAX_PARALLEL_SKILLS))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(
                _generate_skill_questions,
                agent,
                skill_plan,
                learning_objective or (f"for the {role} role" if role else ""),
            )
            for skill_plan in plan
        ]
        concurrent.futures.wait(futures)

    all_questions: list[dict] = []
    fallback_chunks: list[dict] = []
    for skill_plan, future in zip(plan, futures):
        try:
            questions, fallback_difficulties = future.result()
        except QuestionGenerationError as exc:
            raise AIAssessmentError(
                f"Diagnostic assessment generation failed on skill "
                f"'{skill_plan.skill}': {exc}"
            ) from exc

        # CRITICAL: each skill numbers its own questions "AI-1".."AI-15"
        # independently — across multiple skills these collide (every skill
        # would have an "AI-1"). Since evaluation matches answers by
        # TempID, colliding IDs silently corrupt scoring (a later skill's
        # answer overwrites an earlier skill's under the same key).
        # Re-namespace by skill right here, once, so every ID in the
        # aggregated set is globally unique.
        for q in questions:
            q["TempID"] = f"{skill_plan.skill}::{q['TempID']}"

        all_questions.extend(questions)
        fallback_chunks.extend(
            {"skill": skill_plan.skill, "difficulty": d} for d in fallback_difficulties
        )

    bank_count = sum(1 for q in all_questions if q.get("Source") == "Bank")
    if bank_count == 0:
        source = "ai"
    elif bank_count == len(all_questions):
        source = "bank"
    else:
        source = "mixed"

    return {
        "skills": skills,
        "totalQuestions": len(all_questions),
        "questions": all_questions,
        "source": source,
        "fallbackChunks": fallback_chunks,
    }


def _generate_skill_questions(
    agent: QuestionGenerationAgent, skill_plan: SkillPlan, learning_objective: str
) -> tuple[list[dict], list[str]]:
    """
    One skill's full question set, generated chunk by chunk (one Gemini
    call per difficulty — same chunking as QuestionGenerationAgent.
    run_chunked, but driven from here so a failed chunk can be swapped for
    bank questions without redoing the chunks that worked).

    Per chunk: try AI -> on success, write it through to the bank; on
    QuestionGenerationError, try the bank; if the bank can't fully cover
    the chunk either, raise the original AI error (plus a note) so the
    failure message stays specific.

    Returns (questions numbered "AI-1".."AI-n" in difficulty order,
    difficulties that were served from the bank). The agent itself stays
    Firestore-free — all bank I/O lives in question_bank_service.
    """
    questions: list[dict] = []
    fallback_difficulties: list[str] = []
    difficulties = [d for d, n in skill_plan.difficulty_counts.items() if n > 0]

    for idx, difficulty in enumerate(difficulties):
        total = skill_plan.difficulty_counts[difficulty]
        open_count = min(skill_plan.open_ended_counts.get(difficulty, 0), total)
        mcq_count = total - open_count

        try:
            chunk = agent.run_chunked(
                topics=[skill_plan.skill],
                skill=skill_plan.skill,
                difficulty_counts={difficulty: total},
                open_ended_counts={difficulty: open_count},
                open_ended_type=skill_plan.open_ended_type,
                learning_objective=learning_objective,
            )
        except QuestionGenerationError as ai_exc:
            chunk = question_bank_service.fetch_fallback_chunk(
                skill=skill_plan.skill,
                difficulty=difficulty,
                mcq_count=mcq_count,
                open_count=open_count,
                open_ended_type=skill_plan.open_ended_type,
            )
            if chunk is None:
                raise QuestionGenerationError(
                    f"{ai_exc} (question bank could not cover {difficulty} for "
                    f"'{skill_plan.skill}' either)"
                ) from ai_exc
            fallback_difficulties.append(difficulty)
        else:
            # Validated AI output -> bank (async, never raises).
            question_bank_service.save_generated_questions(chunk)

        questions.extend(chunk)

        # Same spacing run_chunked used between its own chunks — protects
        # one skill's key/quota from bursting.
        if idx < len(difficulties) - 1:
            time.sleep(settings.AI_CHUNK_DELAY_SECONDS)

    for i, q in enumerate(questions, start=1):
        q["TempID"] = f"AI-{i}"

    return questions, fallback_difficulties


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
