"""
routes/flashcard_routes.py

    POST   /api/flashcards/generate     -> {uid, mode: "topic"|"chat"|"sources", skill?, topic?, focusBand?, sessionId?, count?}
    GET    /api/flashcards/<uid>        -> list saved flashcard sets
    DELETE /api/flashcards/<uid>/<setId> -> remove a set

Thin — delegates to services/flashcard_service.py.
"""

from flask import Blueprint, request

from services.flashcard_service import (
    generate_from_topic,
    generate_from_chat,
    generate_from_sources,
    generate_from_custom_text,
    list_flashcard_sets,
    delete_flashcard_set,
    FlashcardServiceError,
)
from utils.response_helper import success_response, error_response
from utils.user_auth import require_owner, require_owner_body
from utils.rate_limiter import limiter

flashcard_bp = Blueprint("flashcards", __name__)


@flashcard_bp.route("/flashcards/generate", methods=["POST"])
@limiter.limit("15 per minute")
@require_owner_body()
def generate_flashcards_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    uid = payload.get("uid")
    mode = payload.get("mode")
    count = payload.get("count")

    if not uid or mode not in ("topic", "chat", "sources", "custom"):
        return error_response(
            "Request body must include 'uid' and mode ('topic', 'chat', 'sources', or 'custom').", status_code=400
        )

    try:
        if mode == "topic":
            skill, topic, focus_band = payload.get("skill"), payload.get("topic"), payload.get("focusBand")
            if not skill or not topic or not focus_band:
                return error_response(
                    "mode='topic' requires 'skill', 'topic', and 'focusBand'.", status_code=400
                )
            result = generate_from_topic(uid, skill, topic, focus_band, count=count)
        elif mode == "chat":
            result = generate_from_chat(uid, payload.get("sessionId"), count=count)
        elif mode == "custom":
            result = generate_from_custom_text(uid, payload.get("text", ""), count=count)
        else:
            result = generate_from_sources(uid, count=count)
        return success_response(data=result, message="Flashcards generated.")
    except FlashcardServiceError as exc:
        return error_response(str(exc), status_code=422)


@flashcard_bp.route("/flashcards/<uid>", methods=["GET"])
@require_owner()
def list_flashcards_route(uid):
    sets_ = list_flashcard_sets(uid)
    return success_response(data={"sets": sets_}, message="Flashcard sets loaded.")


@flashcard_bp.route("/flashcards/<uid>/<set_id>", methods=["DELETE"])
@require_owner()
def delete_flashcards_route(uid, set_id):
    delete_flashcard_set(uid, set_id)
    return success_response(data=None, message="Flashcard set removed.")
