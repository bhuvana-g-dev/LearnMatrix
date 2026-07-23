"""
routes/activity_routes.py

POST /api/activity/ping/<uid>  -> records today as an active day
GET  /api/activity/<uid>       -> returns all recorded active dates
"""

from datetime import datetime, timezone

from flask import Blueprint

from firebase.firebase_config import get_firestore_client
from services.activity_repository import record_activity, get_activity_dates
from utils.response_helper import success_response, error_response

activity_bp = Blueprint("activity", __name__)


@activity_bp.route("/activity/ping/<uid>", methods=["POST"])
def ping_activity_route(uid):
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        db = get_firestore_client()
        record_activity(db, uid, today)
        return success_response(data={"date": today}, message="Activity recorded.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@activity_bp.route("/activity/<uid>", methods=["GET"])
def get_activity_route(uid):
    try:
        db = get_firestore_client()
        dates = get_activity_dates(db, uid)
        return success_response(data={"dates": dates}, message=f"{len(dates)} active day(s) on record.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
