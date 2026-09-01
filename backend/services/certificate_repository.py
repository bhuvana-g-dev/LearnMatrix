"""
services/certificate_repository.py

The ONLY module that touches the `certificates` Firestore collection
(settings.CERTIFICATES_COLLECTION). Same one-document-per-user,
dependency-injection pattern as services/roadmap_repository.py — a
student has exactly one active certificate at a time, tracking whatever
career path their current roadmap is for.

Firestore document layout — ONE document per user:

    certificates/{uid}
        uid, courseName, roleId, certificateId,
        status ("in_progress" | "completed"),
        startedOn, completedOn (None until completed),
        updatedAt
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _doc_ref(db, uid: str):
    return db.collection(settings.CERTIFICATES_COLLECTION).document(uid)


def get_certificate(db, uid: str) -> dict | None:
    snap = _doc_ref(db, uid).get()
    return snap.to_dict() if snap.exists else None


def save_certificate(db, uid: str, data: dict) -> dict:
    doc_ref = _doc_ref(db, uid)
    payload = {**data, "uid": uid, "updatedAt": SERVER_TIMESTAMP}
    doc_ref.set(payload, merge=False)
    return doc_ref.get().to_dict()


def update_certificate(db, uid: str, patch: dict) -> dict:
    doc_ref = _doc_ref(db, uid)
    doc_ref.set({**patch, "updatedAt": SERVER_TIMESTAMP}, merge=True)
    return doc_ref.get().to_dict()


def delete_certificate(db, uid: str) -> None:
    """Removes this user's certificate doc entirely. Safe to call even
    if no document exists — part of the admin "permanently delete this
    student" flow (see services/user_deletion_service.py)."""
    _doc_ref(db, uid).delete()
