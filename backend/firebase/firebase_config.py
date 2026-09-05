import os
import json

import firebase_admin
from firebase_admin import credentials, firestore, storage

from config.settings import settings

_initialized = False


def _ensure_initialized() -> None:
    global _initialized

    if _initialized:
        return

    # ---------- Render Production ----------
    firebase_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")

    if firebase_json:
        cred = credentials.Certificate(json.loads(firebase_json))

    # ---------- Local Development ----------
    else:
        if not os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH):
            raise FileNotFoundError(
                "Firebase service account key not found at "
                f"'{settings.FIREBASE_SERVICE_ACCOUNT_PATH}'."
            )

        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)

    # storageBucket is only passed when configured — apps that haven't
    # set FIREBASE_STORAGE_BUCKET keep working exactly as before (they
    # just never get a usable bucket() call, which services/audio_storage.py
    # already treats as "skip storage, fall back to re-synthesizing").
    init_options = {"storageBucket": settings.FIREBASE_STORAGE_BUCKET} if settings.FIREBASE_STORAGE_BUCKET else {}
    firebase_admin.initialize_app(cred, init_options)
    _initialized = True


def get_firestore_client():
    _ensure_initialized()
    return firestore.client()


def get_storage_bucket():
    """Returns the default Storage bucket, or None if FIREBASE_STORAGE_BUCKET
    isn't configured — callers (services/audio_storage.py) treat None as
    "storage isn't set up", not an error."""
    if not settings.FIREBASE_STORAGE_BUCKET:
        return None
    _ensure_initialized()
    return storage.bucket()
