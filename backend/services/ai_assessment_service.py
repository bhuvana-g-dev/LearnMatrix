"""
services/ai_assessment_service.py

Orchestration layer for AI Agent routes. For this proof-of-concept slice,
it wires exactly one agent (QuestionGenerationAgent). As the remaining
agents in ARCHITECTURE.md are built (Assessment Planner, Quality
Validation, Assessment Builder, ...), this file grows into the place
where they're chained together — routes/ai_assessment_routes.py should
never need to change shape when that happens, only this file.
"""

from agents.question_generation_agent import (
    QuestionGenerationAgent,
    QuestionGenerationError,
)


class AIAssessmentError(Exception):
    pass


def generate_ai_questions(
    skill: str,
    topics: list[str],
    difficulty: str,
    count: int,
    learning_objective: str = "",
) -> list[dict]:
    """
    Runs the Question Generation Agent and returns its output directly.
    Not persisted anywhere — per the architecture rule, AI-generated
    questions are ephemeral until the (future) Assessment Builder Agent
    assembles them into an assessment the student actually takes.
    """
    agent = QuestionGenerationAgent()
    try:
        return agent.run(
            topics=topics,
            difficulty=difficulty,
            count=count,
            skill=skill,
            learning_objective=learning_objective,
        )
    except QuestionGenerationError as exc:
        raise AIAssessmentError(str(exc)) from exc
