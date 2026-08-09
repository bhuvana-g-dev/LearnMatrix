"""
routes/skill_topic_routes.py

    GET /api/skills/<skill>/topics    -> ordered topic list for one skill
    GET /api/roles/<roleId>/syllabus  -> full role -> skill -> topics tree

This route ONLY parses the request and delegates to
services/skill_topic_service.py. No business logic, no Firebase calls
here — same rule as every other routes/ file in this codebase.

<skill> is passed as-is in the URL and must match a Skill value in
Firestore exactly (e.g. "HTML5", "React.js", "Tailwind CSS" — spaces
and dots included). The frontend already has these exact strings in
constants/skills.js, so no slug/encoding layer is introduced here.
"""

from flask import Blueprint, request

from firebase.firebase_config import get_firestore_client
from services.skill_topic_service import (
    get_topics_for_skill,
    get_syllabus_for_role,
    SkillTopicError,
)
from services.syllabus_compression_service import get_compressed_role_syllabus
from utils.response_helper import success_response, error_response

skill_topic_bp = Blueprint("skill_topics", __name__)


@skill_topic_bp.route("/skills/<path:skill>/topics", methods=["GET"])
def get_skill_topics(skill: str):
    try:
        db = get_firestore_client()
        topics = get_topics_for_skill(db, skill)
        return success_response(
            data={"skill": skill, "topicCount": len(topics), "topics": topics},
            message="Skill topics fetched successfully.",
        )
    except Exception as exc:  # noqa: BLE001 - single top-level guard per route
        return error_response(str(exc), status_code=500)


@skill_topic_bp.route("/roles/<role_id>/syllabus", methods=["GET"])
def get_role_syllabus(role_id: str):
    try:
        db = get_firestore_client()
        syllabus = get_syllabus_for_role(db, role_id)
        return success_response(data=syllabus, message="Role syllabus fetched successfully.")
    except SkillTopicError as exc:
        return error_response(str(exc), status_code=404)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@skill_topic_bp.route("/roles/<role_id>/compressed-syllabus", methods=["POST"])
def get_compressed_role_syllabus_route(role_id: str):
    """
    Compression Engine (services/syllabus_compression_service.py):
    given the same evaluation object POST /api/ai/generate-roadmap
    accepts, returns the full role syllabus tree with each skill's
    topics marked Verified/Current/Locked based on the diagnostic score
    — the topic-level counterpart to the skill-level roadmap.
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    evaluation = payload.get("evaluation")
    if not evaluation or not isinstance(evaluation, dict) or "skills" not in evaluation:
        return error_response(
            "Request body must include 'evaluation' — the exact object "
            "returned by evaluate-diagnostic-assessment.",
            status_code=400,
        )

    try:
        db = get_firestore_client()
        result = get_compressed_role_syllabus(db, role_id, evaluation)
        return success_response(data=result, message="Compressed syllabus generated successfully.")
    except SkillTopicError as exc:
        return error_response(str(exc), status_code=404)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
