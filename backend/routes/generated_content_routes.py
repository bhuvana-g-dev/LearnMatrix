"""
routes/generated_content_routes.py

Admin CRUD (read + delete only — this content is never hand-authored)
for the shared/reused AI-generated learning content cache
(services/generated_content_service.py -> services/notes_repository.py's
`learning_notes` collection). Separate from routes/learning_routes.py's
Resource Bank endpoints on purpose — see that section's docstring: two
different concepts (admin-managed resources vs system-generated shared
content) get two different route files, matching the Admin Panel's two
separate nav sections.

    GET    /api/admin/generated-content        -> list (filters: skill, topic)
    GET    /api/admin/generated-content/<id>   -> one item, full content
    DELETE /api/admin/generated-content/<id>   -> remove; next learner
        request for that (skill, topic, focusBand) regenerates fresh
        content and re-caches it under the same id (see
        services/learning_content_service.py) — no other change needed.
"""

from flask import Blueprint, request

from services.generated_content_service import (
    list_generated_content,
    get_generated_content,
    delete_generated_content,
    GeneratedContentError,
)
from utils.admin_auth import require_admin
from utils.response_helper import success_response, error_response

generated_content_bp = Blueprint("generated_content", __name__)


@generated_content_bp.route("/admin/generated-content", methods=["GET"])
@require_admin
def list_generated_content_route():
    try:
        items = list_generated_content(
            skill=request.args.get("skill") or None,
            topic=request.args.get("topic") or None,
        )
        return success_response(data=items, message=f"{len(items)} generated content item(s) found.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@generated_content_bp.route("/admin/generated-content/<doc_id>", methods=["GET"])
@require_admin
def get_generated_content_route(doc_id):
    try:
        item = get_generated_content(doc_id)
        return success_response(data=item, message="Generated content loaded.")
    except GeneratedContentError as exc:
        return error_response(str(exc), status_code=404)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@generated_content_bp.route("/admin/generated-content/<doc_id>", methods=["DELETE"])
@require_admin
def delete_generated_content_route(doc_id):
    try:
        delete_generated_content(doc_id)
        return success_response(data=None, message="Generated content deleted. It will regenerate on next request.")
    except GeneratedContentError as exc:
        return error_response(str(exc), status_code=404)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
