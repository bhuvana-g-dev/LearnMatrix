"""
routes/role_routes.py

GET /api/roles -> list of selectable roles (Frontend Developer, etc.)

This route ONLY parses the request and delegates to services/role_service.py.
No business logic, no Firebase, no pandas here.
"""

from flask import Blueprint
from services.role_service import get_all_roles
from utils.response_helper import success_response, error_response

role_bp = Blueprint("roles", __name__)


@role_bp.route("/roles", methods=["GET"])
def get_roles():
    try:
        roles = get_all_roles()
        return success_response(data=roles, message="Roles fetched successfully.")
    except Exception as exc:  # noqa: BLE001 - single top-level guard per route
        return error_response(str(exc), status_code=500)
