"""
services/phone_otp_service.py

Real SMS OTP verification for signup, via Fast2SMS's "otp" route
(https://www.fast2sms.com/dev/bulkV2?route=otp) — chosen over Firebase
Phone Auth specifically because it needs NO billing account: just a
free API key, and new Fast2SMS accounts start with a small free
wallet credit. Swap this one module out later if a different SMS
provider is ever needed — routes/repository don't know which
provider sends the message.

Flow:
  1. send_phone_otp(mobile)         -> generates a 6-digit code, saves
                                        it (phone_otp_repository), and
                                        asks Fast2SMS to deliver it.
  2. verify_phone_otp(mobile, code) -> checks the stored code against
                                        expiry + attempt count; the
                                        record is deleted either way
                                        (success OR exhausted) so a
                                        code is never reusable.

Nothing here creates a Firebase Auth user or Firestore profile — this
ONLY proves the number is reachable. SignUpScreen.jsx calls this
BEFORE the actual signup request (same order the earlier Firebase
Phone Auth version used), then proceeds to create the real account
via email/password only once verify_phone_otp succeeds.
"""

import logging
import random
import time

import requests

from config.settings import settings
from firebase.firebase_config import get_firestore_client
from services.phone_otp_repository import (
    MAX_ATTEMPTS,
    delete_otp,
    get_otp,
    increment_attempts,
    save_otp,
)

logger = logging.getLogger(__name__)

FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


class OtpError(Exception):
    """Message is safe to show the user directly — routes pass it straight through."""


def send_phone_otp(mobile: str) -> None:
    if not settings.FAST2SMS_API_KEY:
        raise OtpError("SMS OTP isn't configured on the server yet.")

    code = f"{random.randint(0, 999999):06d}"
    db = get_firestore_client()
    save_otp(db, mobile, code)

    try:
        resp = requests.get(
            FAST2SMS_URL,
            params={
                "authorization": settings.FAST2SMS_API_KEY,
                "route": "otp",
                "variables_values": code,
                "numbers": mobile,
            },
            timeout=10,
        )
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Fast2SMS request failed")
        raise OtpError("Couldn't send the OTP right now. Please try again.") from exc

    # Fast2SMS's own success flag — a 200 HTTP response can still carry
    # return=False (bad API key, empty wallet, invalid number, etc.).
    if not data.get("return"):
        logger.error("Fast2SMS rejected the send for %s: %s", mobile, data)
        msg = data.get("message")
        friendly = msg[0] if isinstance(msg, list) and msg else "Couldn't send the OTP. Please try again."
        raise OtpError(friendly)


def verify_phone_otp(mobile: str, code: str) -> None:
    db = get_firestore_client()
    record = get_otp(db, mobile)
    if not record:
        raise OtpError("No OTP was sent to this number, or it already expired. Please request a new one.")

    expires_at = record.get("expiresAt")
    if expires_at and expires_at.timestamp() < time.time():
        delete_otp(db, mobile)
        raise OtpError("That code expired. Please request a new one.")

    if record.get("attempts", 0) >= MAX_ATTEMPTS:
        delete_otp(db, mobile)
        raise OtpError("Too many incorrect attempts. Please request a new code.")

    if record.get("code") != code:
        increment_attempts(db, mobile)
        raise OtpError("That code doesn't match. Please check and try again.")

    delete_otp(db, mobile)  # one-time use — can't be replayed
