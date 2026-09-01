"""
services/activity_repository.py

The ONLY module that touches the `learning_activity` Firestore
collection — a small, honest streak tracker (real data, not a
decorative fake widget).

    learning_activity/{uid}
        dates: array of "YYYY-MM-DD" strings — every distinct calendar
               day this student has opened the app while authenticated.

Uses Firestore's ArrayUnion so recording today twice in the same
session is a safe no-op (no duplicate entries, no read-before-write
race condition needed).
"""

from firebase_admin import firestore

from config.settings import settings

ArrayUnion = firestore.ArrayUnion


def _doc_ref(db, uid: str):
    return db.collection(settings.ACTIVITY_COLLECTION).document(uid)


def record_activity(db, uid: str, date_str: str) -> None:
    """date_str: "YYYY-MM-DD", computed by the caller (route) so this
    module has no opinion on timezone — that's the frontend/route's call."""
    _doc_ref(db, uid).set({"dates": ArrayUnion([date_str])}, merge=True)


def get_activity_dates(db, uid: str) -> list[str]:
    """Returns [] for a brand-new user — not an error, just no history yet."""
    snap = _doc_ref(db, uid).get()
    if not snap.exists:
        return []
    return snap.to_dict().get("dates", [])


def delete_activity(db, uid: str) -> None:
    """Removes this user's streak doc entirely. Safe to call even if no
    document exists — part of the admin "permanently delete this
    student" flow (see services/user_deletion_service.py)."""
    _doc_ref(db, uid).delete()
