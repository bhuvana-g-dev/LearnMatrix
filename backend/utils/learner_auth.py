"""
utils/learner_auth.py

Learner-auth decorator for the learning-path route, kept separate from
utils/user_auth.py's require_owner() for one reason: that decorator
checks the verified token's uid against a <uid> URL/query param the
route already has — routes/learning_routes.py's
GET /learning/path/<skill>/<topic> deliberately has NO uid param at
all (uid comes ONLY from the token, see that route's docstring), so
there's nothing for require_owner() to compare against.

Reuses user_auth.py's verify_user_token() directly rather than
re-verifying the Firebase token itself — that used to be duplicated
here before utils/user_auth.py existed; now there is exactly one place
that decodes/validates a Firebase ID token for non-admin routes.
"""

from functools import wraps

from flask import g, request

from utils.response_helper import error_response
from utils.user_auth import verify_user_token, UserAuthError


def _extract_bearer_token() -> str | None:
    # Small and local on purpose, same as admin_auth.py's own copy —
    # user_auth.py's version is name-mangled (_extract_bearer_token)
    # and not meant to be imported across modules; only
    # verify_user_token() is this module's actual shared dependency.
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header[len("Bearer "):].strip()


def require_learner(route_fn):
    """Decorator for learner-facing routes that must derive `uid` from
    the caller's own verified token rather than trusting a uid passed
    in the URL/query/body. On success, stashes the decoded token on
    flask.g.learner (so g.learner["uid"] is the authenticated caller)."""

    @wraps(route_fn)
    def wrapper(*args, **kwargs):
        try:
            token = _extract_bearer_token()
            g.learner = verify_user_token(token)
        except UserAuthError as exc:
            return error_response(exc.message, status_code=exc.status_code)
        return route_fn(*args, **kwargs)

    return wrapper
