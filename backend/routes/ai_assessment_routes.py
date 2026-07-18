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

from services.ai_assessment_service import (
    generate_ai_questions,
    generate_diagnostic_assessment,
    evaluate_assessment,
    AIAssessmentError,
)
from services.roadmap_service import generate_roadmap, generate_and_save_roadmap
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


@ai_assessment_bp.route("/ai/generate-diagnostic-assessment", methods=["POST"])
def generate_diagnostic_assessment_route():
    """
    The real diagnostic assessment described in ARCHITECTURE.md's
    "core intelligence" upgrade: one call per selected skill, each a
    fixed 2 Easy + 2 Medium + 2 Hard split (services/assessment_planner.py),
    so the Evaluation Agent below has consistent, comparable data per skill.
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    skills = payload.get("skills")
    role = payload.get("role", "")
    learning_objective = payload.get("learning_objective", "")

    if not skills or not isinstance(skills, list):
        return error_response(
            "Request body must include 'skills' (non-empty list).",
            status_code=400,
        )

    try:
        result = generate_diagnostic_assessment(
            skills=skills, role=role, learning_objective=learning_objective
        )
        return success_response(
            data=result,  # {skills, totalQuestions, questions}
            message=f"Generated {result['totalQuestions']} diagnostic question(s) "
                    f"across {len(skills)} skill(s).",
        )
    except AIAssessmentError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@ai_assessment_bp.route("/ai/evaluate-diagnostic-assessment", methods=["POST"])
def evaluate_diagnostic_assessment_route():
    """
    Evaluation Agent (#5): given the same questions the diagnostic
    assessment generated plus the student's answers, returns the
    skill-wise breakdown table (Easy/Medium/Hard correct counts, score
    percent, and Strong/Intermediate/Weak/Not Attempted classification).

    Deliberately stateless — the frontend sends back the exact questions
    array it received from generate-diagnostic-assessment, since nothing
    is persisted server-side yet (see ARCHITECTURE.md §9 Phase 3 for when
    quiz_results/assessment_history land in Firestore).
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    questions = payload.get("questions")
    answers = payload.get("answers")

    if not questions or not isinstance(questions, list):
        return error_response(
            "Request body must include 'questions' (the array returned by "
            "generate-diagnostic-assessment).",
            status_code=400,
        )
    if answers is None or not isinstance(answers, dict):
        return error_response(
            "Request body must include 'answers' as an object of "
            "{TempID: chosen_option} (skipped questions simply omitted).",
            status_code=400,
        )

    try:
        result = evaluate_assessment(questions, answers)
        return success_response(
            data=result,  # {skills: [...], overall: {...}}
            message=f"Evaluated {len(questions)} question(s) across "
                    f"{len(result['skills'])} skill(s).",
        )
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@ai_assessment_bp.route("/ai/generate-roadmap", methods=["POST"])
def generate_roadmap_route():
    """
    Roadmap Agent (#9): given an evaluation result (the exact object
    returned by evaluate-diagnostic-assessment), produces an ordered
    study plan — weakest/skipped skills first, "Strong" skills set aside
    as already known. Deliberately NOT an AI call (see roadmap_service.py
    docstring) — this always succeeds, even if every LLM provider in the
    fallback chain is down.

    If 'uid' is provided, the roadmap is also saved to Firestore
    (fully replacing any previous one for this user) so it persists
    across page reloads and can be loaded later via
    GET /api/roadmap/<uid> — this is the "don't regenerate every time
    the page opens" requirement. Without a uid, the roadmap is still
    generated and returned, just not persisted (useful for testing).
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    evaluation = payload.get("evaluation")
    uid = payload.get("uid")
    role = payload.get("role", "")

    if not evaluation or not isinstance(evaluation, dict) or "skills" not in evaluation:
        return error_response(
            "Request body must include 'evaluation' — the exact object "
            "returned by evaluate-diagnostic-assessment.",
            status_code=400,
        )

    try:
        if uid:
            roadmap_dict = generate_and_save_roadmap(uid=uid, role=role, evaluation=evaluation)
            total_weeks = roadmap_dict["totalWeeks"]
            entry_count = len(roadmap_dict["entries"])
        else:
            roadmap = generate_roadmap(evaluation)
            roadmap_dict = roadmap.to_dict()
            total_weeks = roadmap.total_weeks
            entry_count = len(roadmap.entries)

        return success_response(
            data=roadmap_dict,
            message=f"Generated a {total_weeks}-week roadmap covering {entry_count} skill(s)."
                    + (" (saved)" if uid else " (not saved — no uid provided)"),
        )
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
