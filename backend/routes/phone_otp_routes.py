"""
routes/phone_otp_routes.py

POST /api/phone-otp/send    body: {mobile}       -> real SMS OTP via Fast2SMS
POST /api/phone-otp/verify  body: {mobile, code} -> checks the OTP

Unauthenticated on purpose (unlike every other route in this app,
which gates on @require_owner()) — this runs BEFORE the account
exists, so there's no uid yet to check ownership of. Rate-limited
instead, keyed by IP (utils/rate_limiter.py's _rate_limit_key falls
back to IP whenever no uid is present in the path or body) — this is
what stops the endpoint being used to drain the Fast2SMS wallet
balance rather than an auth check.
"""

import logging
import re

from flask import Blueprint, request

from services.phone_otp_service import OtpError, send_phone_otp, verify_phone_otp
from utils.rate_limiter import limiter
from utils.response_helper import error_response, success_response

logger = logging.getLogger(__name__)

phone_otp_bp = Blueprint("phone_otp", __name__)

_MOBILE_RE = re.compile(r"^[0-9]{10}$")
_CODE_RE = re.compile(r"^[0-9]{6}$")


@phone_otp_bp.route("/phone-otp/send", methods=["POST"])
@limiter.limit("3 per minute")
@limiter.limit("10 per hour")
def send_phone_otp_route():
    try:
        body = request.get_json(silent=True) or {}
        mobile = str(body.get("mobile", "")).strip()
        if not _MOBILE_RE.match(mobile):
            return error_response("Enter a valid 10-digit mobile number.", status_code=400)
        send_phone_otp(mobile)
        return success_response(message="OTP sent.")
    except OtpError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)


@phone_otp_bp.route("/phone-otp/verify", methods=["POST"])
@limiter.limit("10 per minute")
def verify_phone_otp_route():
    try:
        body = request.get_json(silent=True) or {}
        mobile = str(body.get("mobile", "")).strip()
        code = str(body.get("code", "")).strip()
        if not _MOBILE_RE.match(mobile) or not _CODE_RE.match(code):
            return error_response("Invalid mobile number or code.", status_code=400)
        verify_phone_otp(mobile, code)
        return success_response(message="Phone number verified.")
    except OtpError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)
