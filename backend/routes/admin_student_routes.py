"""
routes/admin_student_routes.py

Admin-only student activity view — real data joined from
services/student_records_service.py (assessment_results + roadmaps +
learning_activity + Firebase Auth), never invented.

    GET /api/admin/students          -> JSON list for the on-screen table
    GET /api/admin/students/export   -> .xlsx download (Student Summary +
                                          Quiz Attempts sheets)
"""

import logging

from flask import Blueprint, send_file, request, g

from services.student_records_service import get_student_summaries, build_export_workbook
from services.user_deletion_service import delete_user_account, UserDeletionError
from utils.admin_auth import require_admin
from utils.response_helper import success_response, error_response

logger = logging.getLogger(__name__)

admin_student_bp = Blueprint("admin_student", __name__)


@admin_student_bp.route("/admin/students", methods=["GET"])
@require_admin
def list_students_route():
    try:
        summaries = get_student_summaries()
        return success_response(data=summaries, message=f"{len(summaries)} student(s) with a completed assessment.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)


@admin_student_bp.route("/admin/students/<uid>", methods=["DELETE"])
@require_admin
def delete_student_route(uid):
    """
    Permanently deletes one student — every uid-keyed Firestore doc
    this app has written for them (assessment, roadmap, activity,
    certificate, chat history, chat sources, flashcards, topic quiz
    progress/attempts) AND the Firebase Auth account itself, via
    services/user_deletion_service.py. Irreversible; there is no undo.
    """
    if uid == (g.admin or {}).get("uid"):
        return error_response("You can't delete your own admin account from here.", status_code=400)

    try:
        result = delete_user_account(uid)
        return success_response(data=result, message=f"Permanently deleted {result.get('email') or uid}.")
    except UserDeletionError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)


@admin_student_bp.route("/admin/students/export", methods=["GET"])
@require_admin
def export_students_route():
    try:
        workbook_buffer = build_export_workbook()
        return send_file(
            workbook_buffer,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="learnmatrix-student-records.xlsx",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)
