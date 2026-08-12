"""
routes/admin_auth_routes.py

    POST /api/admin/session

Called right after the frontend signs a user into Firebase Auth
directly (email/password, via the firebase/auth SDK). Firebase confirms
WHO they are; this route is what confirms WHETHER they're an admin —
server-side, via the `admin` custom claim on their verified ID token
(see utils/admin_auth.py, scripts/grant_admin.py). A valid Firebase
login alone is never treated as sufficient.
"""

from flask import Blueprint, request

from utils.admin_auth import AdminAuthError, verify_admin_token
from utils.response_helper import error_response, success_response

admin_auth_bp = Blueprint("admin_auth", __name__)


@admin_auth_bp.route("/admin/session", methods=["POST"])
def admin_session_route():
    payload = request.get_json(silent=True) or {}
    id_token = payload.get("idToken")

    try:
        decoded = verify_admin_token(id_token)
    except AdminAuthError as exc:
        return error_response(exc.message, status_code=exc.status_code)

    return success_response(
        data={"uid": decoded.get("uid"), "email": decoded.get("email")},
        message="Admin session verified.",
    )
