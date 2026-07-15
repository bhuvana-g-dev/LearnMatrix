"""
routes/ai_assessment_routes.py

AI Agent routes. Registered in app.py the same way every other blueprint
is (url_prefix="/api"), so the full path is:

    POST /api/ai/generate-questions -> Question Generation Agent, with
                                        difficulty either passed explicitly
                                        or decided by the Difficulty Engine
                                        from student performance signals

This is the first slice of the multi-agent architecture in
ARCHITECTURE.md. Later agents (Assessment Planner, Quality Validation,
Assessment Builder, Evaluation, ...) get their own routes here as they're
built, all delegating to services/ai_assessment_service.py — this file
only parses the request, same as every other route module.
"""

from flask import Blueprint, request

from services.ai_assessment_service import generate_ai_questions, AIAssessmentError
from utils.response_helper import success_response, error_response

ai_assessment_bp = Blueprint("ai_assessment", __name__)


@ai_assessment_bp.route("/ai/generate-questions", methods=["POST"])
def generate_questions_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    skill = payload.get("skill")
    topics = payload.get("topics")
    count = payload.get("count")
    difficulty = payload.get("difficulty")  # explicit override, optional
    signals = payload.get("signals")        # Difficulty Engine input, optional
    learning_objective = payload.get("learning_objective", "")

    if not skill or not topics or not count:
        return error_response(
            "Request body must include 'skill', 'topics' (list), and 'count'.",
            status_code=400,
        )
    if not difficulty and not signals:
        return error_response(
            "Request body must include either 'difficulty' (explicit "
            "override) or 'signals' (previous_score, time_taken_seconds, "
            "expected_time_seconds, confidence, mistake_rate) so the "
            "Difficulty Engine can decide.",
            status_code=400,
        )

    try:
        result = generate_ai_questions(
            skill=skill,
            topics=topics,
            count=int(count),
            difficulty=difficulty,
            signals=signals,
            learning_objective=learning_objective,
        )
        return success_response(
            data=result,  # {difficulty, difficulty_reasoning, questions}
            message=f"Generated {len(result['questions'])} question(s) "
                    f"at {result['difficulty']} difficulty.",
        )
    except AIAssessmentError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
