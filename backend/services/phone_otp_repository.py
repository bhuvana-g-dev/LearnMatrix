"""
services/phone_otp_repository.py

The ONLY module that touches the `phone_otps` Firestore collection.
One document per mobile number (10-digit, no country code — same
format the frontend already collects/validates via MOBILE_REGEX).

    phone_otps/{mobile}
        code        -> the 6-digit OTP currently valid for this number
        expiresAt   -> Firestore Timestamp; code is rejected after this
        attempts    -> wrong-guess counter, reset on every new send
        createdAt   -> server timestamp, for observability only

Overwritten (via .set()) on every send — one active code per number at
a time, so requesting a new code invalidates whatever was sent before
it for the same number. This is pre-signup data (no uid exists yet),
so it's keyed by mobile number rather than uid, unlike every other
repository in this app.
"""

from datetime import datetime, timedelta, timezone

from firebase_admin import firestore

COLLECTION = "phone_otps"
CODE_TTL_MINUTES = 5
MAX_ATTEMPTS = 5


def save_otp(db, mobile: str, code: str) -> None:
    db.collection(COLLECTION).document(mobile).set({
        "code": code,
        "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES),
        "attempts": 0,
        "createdAt": firestore.SERVER_TIMESTAMP,
    })


def get_otp(db, mobile: str) -> dict | None:
    doc = db.collection(COLLECTION).document(mobile).get()
    return doc.to_dict() if doc.exists else None


def increment_attempts(db, mobile: str) -> None:
    db.collection(COLLECTION).document(mobile).update({
        "attempts": firestore.Increment(1),
    })


def delete_otp(db, mobile: str) -> None:
    db.collection(COLLECTION).document(mobile).delete()
