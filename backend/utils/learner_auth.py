"""
utils/learner_auth.py

Server-side learner-auth enforcement, for routes that need to know
WHO the caller is without requiring admin access. Sibling to
utils/admin_auth.py, deliberately NOT built on top of it — admin_auth's
verify_admin_token() hard-requires the `admin` custom claim, which a
normal learner will never have. Reusing that function would mean every
learner request gets rejected with 403, not verified.

Instead this duplicates only the token-verification mechanics (decode
+ validate a Firebase ID token) and stops there — no claim check, no
role requirement. That's the entire difference from admin_auth.py.

SCOPE OF THIS INTRODUCTION: every existing learner-facing route
(roadmap_routes.py, topic_quiz_routes.py, etc.) still takes `uid` as a
plain URL/query param today, unauthenticated — this module does not
change any of them. It's written generically enough (require_learner
decorator, g.learner["uid"]) that those routes CAN be migrated onto it
later, one at a time, without needing a different pattern than the one
introduced here for the new learning-path route.
"""

from functools import wraps

from firebase_admin import auth as firebase_auth
from flask import g, request

from firebase.firebase_config import get_firestore_client
from utils.response_helper import error_response


class LearnerAuthError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _extract_bearer_token() -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise LearnerAuthError("Missing or malformed Authorization header.", 401)
    return header[len("Bearer "):].strip()


def verify_learner_token(id_token: str | None) -> dict:
    """Verifies a Firebase ID token and returns the decoded token
    (uid, email, ...) on success; raises LearnerAuthError otherwise.
    No custom-claim check — any signed-in Firebase user is a valid
    learner. See module docstring for why this doesn't call
    admin_auth.verify_admin_token() instead."""
    if not id_token:
        raise LearnerAuthError("ID token is required.", 401)

    # Same "make sure firebase_admin.initialize_app() has run" reasoning
    # as admin_auth.verify_admin_token() — this can be the first
    # Firebase-touching call in a fresh process.
    get_firestore_client()

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as exc:  # noqa: BLE001 — any verification failure means "not authenticated"
        raise LearnerAuthError(f"Invalid or expired ID token: {exc}", 401) from exc

    return decoded


def require_learner(route_fn):
    """Decorator for learner-facing routes that must derive `uid` from
    the caller's own verified token rather than trusting a uid passed
    in the URL/query/body. On success, stashes the decoded token on
    flask.g.learner (so g.learner["uid"] is the authenticated caller)
    and the route function receives no extra args — read uid from
    flask.g.learner["uid"] inside the route body."""

    @wraps(route_fn)
    def wrapper(*args, **kwargs):
        try:
            token = _extract_bearer_token()
            g.learner = verify_learner_token(token)
        except LearnerAuthError as exc:
            return error_response(exc.message, status_code=exc.status_code)
        return route_fn(*args, **kwargs)

    return wrapper
