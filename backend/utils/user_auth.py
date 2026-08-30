"""
utils/user_auth.py

Server-side ownership enforcement for every route that takes a <uid> in
its path (chat, roadmap, flashcards, activity, topic quiz, studio,
assessment result, career path, certificates, ...).

Before this module existed, these routes trusted whatever `uid` showed
up in the URL with zero verification — any client could read or delete
another student's data just by knowing (or guessing/enumerating) their
uid. This mirrors utils/admin_auth.py's pattern (verify the Firebase ID
token via firebase_admin), but instead of checking an `admin` custom
claim, it checks that the token's own uid equals the uid the route is
being asked to act on.

Frontend side: api/axiosClient.js now attaches a fresh Firebase ID
token (`auth.currentUser.getIdToken()`) as `Authorization: Bearer ...`
on every request, so this doesn't require any per-call frontend change
beyond that one interceptor.
"""

from functools import wraps

from firebase_admin import auth as firebase_auth
from flask import g, request

from firebase.firebase_config import get_firestore_client
from utils.response_helper import error_response


class UserAuthError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _extract_bearer_token() -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise UserAuthError("Missing or malformed Authorization header.", 401)
    return header[len("Bearer "):].strip()


def verify_user_token(id_token: str | None) -> dict:
    """Verifies a Firebase ID token. Returns the decoded token (uid,
    email, ...) on success; raises UserAuthError otherwise. Same
    single-source-of-truth idea as admin_auth.verify_admin_token."""
    if not id_token:
        raise UserAuthError("ID token is required.", 401)

    # Idempotent — see admin_auth.verify_admin_token for why this call
    # (rather than a bare firebase_admin.initialize_app()) is here.
    get_firestore_client()

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as exc:  # noqa: BLE001 — any verification failure means "not authenticated"
        raise UserAuthError(f"Invalid or expired ID token: {exc}") from exc

    return decoded


def require_owner(uid_param: str = "uid", source: str = "path"):
    """Decorator factory for routes that act on one uid's data. Verifies
    the bearer token, then checks the token's uid matches the uid the
    route was called with — so e.g. /ai/chat/<uid>/sessions only ever
    lets uid's own signed-in account read uid's own sessions.

    `source` picks where the uid to check comes from:
      - "path"  (default): Flask's URL kwarg, e.g. <uid> in the route
      - "query": ?uid=... query string param (GET routes that take uid
        as a query param instead of a path segment)

    For POST/PATCH routes with uid in the JSON body, use
    require_owner_body() instead.

    Usage:
        @activity_bp.route("/activity/<uid>", methods=["GET"])
        @require_owner()
        def get_activity_route(uid):
            ...

        @topic_quiz_bp.route("/topic-quiz/<skill>/<topic>/attempt", methods=["GET"])
        @require_owner(source="query")
        def get_topic_quiz_attempt_route(skill, topic):
            ...
    """

    def decorator(route_fn):
        @wraps(route_fn)
        def wrapper(*args, **kwargs):
            try:
                token = _extract_bearer_token()
                decoded = verify_user_token(token)
            except UserAuthError as exc:
                return error_response(exc.message, status_code=exc.status_code)

            if source == "query":
                target_uid = request.args.get(uid_param)
            else:
                target_uid = kwargs.get(uid_param)

            if target_uid is not None and decoded.get("uid") != target_uid:
                return error_response(
                    "You don't have access to this account's data.", status_code=403
                )

            g.user = decoded
            return route_fn(*args, **kwargs)

        return wrapper

    return decorator


def require_owner_body(field: str = "uid"):
    """Same idea as require_owner(), but for POST routes where `uid`
    lives in the JSON body instead of the URL (flashcards/generate,
    ai/chat, mindmap/generate, ...). Several of these treat `uid` as
    OPTIONAL — no uid means "generate but don't save to any account" —
    so this only enforces auth when the body actually includes a uid.
    Silently lets un-uid'd (stateless) requests through unauthenticated,
    same behavior as before this fix for that case."""

    def decorator(route_fn):
        @wraps(route_fn)
        def wrapper(*args, **kwargs):
            payload = request.get_json(silent=True) or {}
            body_uid = payload.get(field)

            if body_uid:
                try:
                    token = _extract_bearer_token()
                    decoded = verify_user_token(token)
                except UserAuthError as exc:
                    return error_response(exc.message, status_code=exc.status_code)

                if decoded.get("uid") != body_uid:
                    return error_response(
                        "You don't have access to this account's data.", status_code=403
                    )
                g.user = decoded

            return route_fn(*args, **kwargs)

        return wrapper

    return decorator
