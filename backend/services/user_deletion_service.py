"""
services/user_deletion_service.py

Admin-only. Permanently and irreversibly deletes ONE student's account:
every uid-keyed Firestore document/subcollection this app has ever
written for them, PLUS the Firebase Auth user itself. This is what
backs the "Delete" action on the admin Student Records screen — before
this existed, the only way to remove a student was to delete them by
hand in the Firebase console.

Deliberately conservative about what counts as "this student's data":
only collections a *_repository.py module in this codebase already
owns are touched, each via that module's own delete_*()/delete_all_*()
function — nothing here guesses at a Firestore path that isn't already
documented in an existing repository module. lesson_plans and
learning_notes are NOT touched here: those are shared/reused caches
keyed by (skill, topic[, focusBand]), not by uid — see
services/lesson_repository.py and services/notes_repository.py.

Refuses to delete a uid that itself carries the admin custom claim —
this is a student-deletion tool, not a way to accidentally
de-provision an admin account.
"""

import logging

from firebase_admin import auth as firebase_auth

from firebase.firebase_config import get_firestore_client
from services import (
    activity_repository,
    assessment_repository,
    certificate_repository,
    chat_repository,
    chat_source_repository,
    flashcard_repository,
    roadmap_repository,
    topic_quiz_repository,
)

logger = logging.getLogger(__name__)


class UserDeletionError(Exception):
    pass


def delete_user_account(uid: str) -> dict:
    """
    Wipes every collection listed above for `uid`, then deletes the
    Firebase Auth user itself. Each repository call is safe to run even
    when that particular collection has no doc for this user (every one
    of them already no-ops on a missing document/empty subcollection),
    so a partially-onboarded student (e.g. never took the assessment,
    so no roadmap/certificate yet) deletes cleanly too — nothing here
    requires every collection to have data first.

    Returns a small summary dict for the admin's confirmation toast —
    NOT the deleted data itself (there is nothing left to show once
    this returns).
    """
    if not uid:
        raise UserDeletionError("uid is required.")

    db = get_firestore_client()

    try:
        auth_user = firebase_auth.get_user(uid)
    except firebase_auth.UserNotFoundError:
        auth_user = None

    if auth_user is not None and (auth_user.custom_claims or {}).get("admin"):
        raise UserDeletionError(
            "This account has admin access and can't be deleted from the Student Records screen."
        )

    email = auth_user.email if auth_user else None

    # ---- Firestore: every uid-keyed collection this app writes to ----
    assessment_repository.delete_assessment_result(db, uid)
    roadmap_repository.delete_roadmap(db, uid)
    activity_repository.delete_activity(db, uid)
    certificate_repository.delete_certificate(db, uid)
    chat_repository.delete_all_sessions(db, uid)
    chat_source_repository.delete_all_sources(db, uid)
    flashcard_repository.delete_all_sets(db, uid)
    topic_quiz_repository.delete_all_for_uid(db, uid)

    # ---- Firebase Auth: the sign-in account itself ----
    auth_deleted = False
    if auth_user is not None:
        firebase_auth.delete_user(uid)
        auth_deleted = True

    logger.info(
        "Admin permanently deleted student uid=%s email=%s (auth account deleted=%s)",
        uid, email, auth_deleted,
    )

    return {"uid": uid, "email": email, "authAccountDeleted": auth_deleted}
