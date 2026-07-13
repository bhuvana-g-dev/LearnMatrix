"""
services/skill_service.py

Business logic for skills. `get_skills()` returns dummy data for now.
`submit_skills()` currently just echoes back what it received — later it
will write to the `progress` (or a `user_skills`) Firestore collection,
keyed by the authenticated user's UID.
"""

from datetime import datetime, timezone


def get_all_skills() -> list[dict]:
    # ---- CURRENT (dummy) ----
    return [
        {"id": "python", "name": "Python"},
        {"id": "react", "name": "React"},
        {"id": "sql", "name": "SQL"},
        {"id": "git", "name": "Git"},
        {"id": "java", "name": "Java"},
    ]

    # ---- FUTURE (Firestore) ----
    # from firebase.firebase_config import get_firestore_client
    # db = get_firestore_client()
    # docs = db.collection("skills").stream()
    # return [doc.to_dict() for doc in docs]


def submit_skills(payload: dict) -> dict:
    """
    Accepts { "role": str, "skills": [str, ...] } from the frontend.
    Currently just acknowledges receipt with a timestamp.
    """
    # ---- FUTURE (Firestore) ----
    # from firebase.firebase_config import get_firestore_client
    # db = get_firestore_client()
    # db.collection("progress").document(user_id).set({
    #     "role": payload.get("role"),
    #     "skills": payload.get("skills"),
    #     "submittedAt": firestore.SERVER_TIMESTAMP,
    # })

    return {
        "received": payload,
        "acknowledgedAt": datetime.now(timezone.utc).isoformat(),
    }
