"""
utils/admin_auth.py

Server-side admin-auth enforcement for every /api/admin/* route.
Verifies a Firebase ID token AND that the token carries the `admin: true`
custom claim (granted via scripts/grant_admin.py) — the ID token alone
only proves WHO signed in; the claim is what proves they're actually
allowed in the Admin Panel. This replaces the old dummy localStorage
token, which no backend route ever checked, meaning every /admin/*
endpoint was reachable by anyone who could reach the API at all.
"""

from functools import wraps

from firebase_admin import auth as firebase_auth
from flask import g, request

from firebase.firebase_config import get_firestore_client
from utils.response_helper import error_response


class AdminAuthError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _extract_bearer_token() -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise AdminAuthError("Missing or malformed Authorization header.", 401)
    return header[len("Bearer "):].strip()


def verify_admin_token(id_token: str | None) -> dict:
    """Verifies a Firebase ID token and its `admin` custom claim. Returns
    the decoded token (uid, email, admin, ...) on success; raises
    AdminAuthError otherwise. Both routes/admin_auth_routes.py and
    require_admin() call THIS, so there's exactly one place that
    decides "is this actually an admin."""
    if not id_token:
        raise AdminAuthError("ID token is required.", 401)

    # get_firestore_client() triggers firebase_admin.initialize_app() as
    # a side effect (see firebase/firebase_config.py) — needed here
    # because this can be the FIRST Firebase-touching call in a fresh
    # process (an admin logging in before any other route has run), and
    # firebase_auth.verify_id_token() fails with "the default Firebase
    # app does not exist" if initialize_app() hasn't run yet. Cheap and
    # idempotent — every other Firebase-touching module in this codebase
    # (routes, scripts) does the same before its first real call.
    get_firestore_client()

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as exc:  # noqa: BLE001 — any verification failure means "not authenticated"
        raise AdminAuthError(f"Invalid or expired ID token: {exc}", 401) from exc

    if not decoded.get("admin"):
        raise AdminAuthError("This account does not have admin access.", 403)

    return decoded


def require_admin(route_fn):
    """Decorator for every /api/admin/* route. Verifies the bearer token
    before the route body runs. On success, stashes the decoded claims
    on flask.g.admin (uid/email) in case a route wants them later — none
    do yet, but this is where per-admin audit logging would read from."""

    @wraps(route_fn)
    def wrapper(*args, **kwargs):
        try:
            token = _extract_bearer_token()
            g.admin = verify_admin_token(token)
        except AdminAuthError as exc:
            return error_response(exc.message, status_code=exc.status_code)
        return route_fn(*args, **kwargs)

    return wrapper
