"""
routes/skill_routes.py

GET  /api/skills         -> list of selectable skills
POST /api/submit-skills  -> receive the user's chosen role + skills

NOTE for frontend alignment: src/api/endpoints.js currently expects
  SKILLS.BY_ROLE -> GET  /roles/:roleId/skills
  SKILLS.SUBMIT  -> POST /skills/selection
but this backend follows the brief's literal spec (GET /skills,
POST /submit-skills). Update endpoints.js to match these two paths, or tell
me to rename these routes to match endpoints.js instead — whichever you
prefer, just flagging the mismatch now before it causes a 404 later.
"""

import logging

from flask import Blueprint, request
from services.skill_service import get_all_skills, submit_skills
from utils.response_helper import success_response, error_response

logger = logging.getLogger(__name__)

skill_bp = Blueprint("skills", __name__)


@skill_bp.route("/skills", methods=["GET"])
def get_skills():
    try:
        skills = get_all_skills()
        return success_response(data=skills, message="Skills fetched successfully.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)


@skill_bp.route("/submit-skills", methods=["POST"])
def post_submit_skills():
    payload = request.get_json(silent=True)

    if not payload or "role" not in payload or "skills" not in payload:
        return error_response(
            "Request body must include 'role' and 'skills'.", status_code=400
        )

    try:
        result = submit_skills(payload)
        return success_response(data=result, message="Skills submitted successfully.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)
