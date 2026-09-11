"""
routes/activity_routes.py

POST /api/activity/ping/<uid>  -> records today as an active day
GET  /api/activity/<uid>       -> returns all recorded active dates
"""

import logging

import re

from datetime import datetime, timezone

from flask import Blueprint, request

from firebase.firebase_config import get_firestore_client
from utils.user_auth import require_owner
from services.activity_repository import record_activity, get_activity_dates
from utils.response_helper import success_response, error_response

logger = logging.getLogger(__name__)

activity_bp = Blueprint("activity", __name__)

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@activity_bp.route("/activity/ping/<uid>", methods=["POST"])
@require_owner()
def ping_activity_route(uid):
    try:
        # Prefer the student's own local calendar date (sent by the
        # client) over the server's UTC clock — UTC only rolls over at
        # 5:30 AM IST, which would misfile late-night activity under
        # the previous day. Falls back to UTC if the client omits it
        # (older frontend build, or a non-browser caller).
        body = request.get_json(silent=True) or {}
        local_date = body.get("local_date")
        if local_date and _DATE_RE.match(local_date):
            today = local_date
        else:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        db = get_firestore_client()
        record_activity(db, uid, today)
        return success_response(data={"date": today}, message="Activity recorded.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)


@activity_bp.route("/activity/<uid>", methods=["GET"])
@require_owner()
def get_activity_route(uid):
    try:
        db = get_firestore_client()
        dates = get_activity_dates(db, uid)
        return success_response(data={"dates": dates}, message=f"{len(dates)} active day(s) on record.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)
