"""
services/flashcard_repository.py

The ONLY module that touches the `flashcard_sets` Firestore tree.
Same dependency-injection pattern as every other *_repository.py.

    flashcard_sets/{uid}/sets/{setId}
        title, sourceType ("topic"|"chat"), cards: [{question, answer}], createdAt
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _sets_ref(db, uid: str):
    return db.collection(settings.FLASHCARD_SETS_COLLECTION).document(uid).collection("sets")


def save_set(db, uid: str, title: str, source_type: str, cards: list[dict]) -> str:
    doc_ref = _sets_ref(db, uid).document()
    doc_ref.set(
        {
            "title": title,
            "sourceType": source_type,
            "cards": cards,
            "createdAt": SERVER_TIMESTAMP,
        }
    )
    return doc_ref.id


def list_sets(db, uid: str) -> list[dict]:
    docs = _sets_ref(db, uid).order_by("createdAt", direction=firestore.Query.DESCENDING).stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    return result


def delete_set(db, uid: str, set_id: str) -> None:
    _sets_ref(db, uid).document(set_id).delete()