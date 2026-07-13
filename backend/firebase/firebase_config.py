import os
import json

import firebase_admin
from firebase_admin import credentials, firestore

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

    firebase_admin.initialize_app(cred)
    _initialized = True


def get_firestore_client():
    _ensure_initialized()
    return firestore.client()
