"""
services/role_service.py

Business logic for roles. Right now this returns hardcoded dummy data.
Later, this function's INSIDE changes to read from the `users`/a `roles`
Firestore collection — routes/role_routes.py will not need to change at all.
"""


def get_all_roles() -> list[dict]:
    # ---- CURRENT (dummy) ----
    return [
        {"id": "frontend-developer", "name": "Frontend Developer"},
        {"id": "backend-developer", "name": "Backend Developer"},
        {"id": "full-stack-developer", "name": "Full-Stack Developer"},
        {"id": "data-analyst", "name": "Data Analyst"},
        {"id": "ml-engineer", "name": "ML Engineer"},
    ]

    # ---- FUTURE (Firestore) ----
    # from firebase.firebase_config import get_firestore_client
    # db = get_firestore_client()
    # docs = db.collection("roles").stream()
    # return [doc.to_dict() for doc in docs]
