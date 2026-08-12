"""
utils/auth_lookup.py

Single shared uid <-> email helper for admin-only screens. Extracted
from services/student_records_service.py's original inline
_email_for_uid() so services/learner_intelligence_service.py doesn't
duplicate the same try/except Firebase Auth lookup — both are the same
operation (resolving a Firebase Auth user), so there should only be one
implementation.
"""

from firebase_admin import auth as firebase_auth


def email_for_uid(uid: str) -> str:
    """Best-effort — a uid can outlive its Auth record (deleted account,
    emulator data, etc.), so this never raises; '—' just means 'not
    resolvable right now', not an error in the caller."""
    try:
        return firebase_auth.get_user(uid).email or "—"
    except Exception:  # noqa: BLE001 — any Auth lookup failure degrades the same way
        return "—"


def uid_for_email(email: str) -> str | None:
    """Reverse lookup for admin search-by-email. None means no Firebase
    Auth user with that email exists (typo, or genuinely no such user) —
    callers treat that as 'no results', not an error."""
    try:
        return firebase_auth.get_user_by_email(email).uid
    except Exception:  # noqa: BLE001
        return None
