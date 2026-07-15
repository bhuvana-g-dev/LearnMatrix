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
from services.difficulty_engine import compute_difficulty, DifficultyDecision


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
