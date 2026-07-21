"""
services/resource_repository.py

The ONLY module that touches the `learning_resources` Firestore
collection.

Every resource has a `status`:
    "pending"  — AI-suggested, not yet reviewed by an admin. NEVER shown
                 to students.
    "verified" — an admin manually checked the link works and is a good
                 fit, and approved it. Shown to students.
    "rejected" — an admin checked it and it was bad (broken link, wrong
                 topic, low quality). Kept (not deleted) so the same bad
                 suggestion isn't re-suggested and re-reviewed forever.

This status field is the actual safety mechanism for the "AI suggests,
human verifies" workflow: agents/resource_suggestion_agent.py can
hallucinate a fake or wrong link (same risk as any LLM asked to recall a
URL — see that agent's docstring), but nothing it produces is ever
visible to a student until a human explicitly flips it to "verified".

    learning_resources/{resourceId}
        skill, topic, type ("video" | "documentation" | "github"),
        title, url, status, source ("ai_suggested" | "manual"),
        addedAt, reviewedAt
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP
VALID_STATUSES = ["pending", "verified", "rejected"]


def add_resource(
    db, skill: str, topic: str, resource_type: str, title: str, url: str,
    status: str = "verified", source: str = "manual",
) -> dict:
    """
    Default status="verified" because a resource typed in directly by an
    admin (source="manual") has already been implicitly checked by the
    person adding it — only AI-suggested resources (source="ai_suggested")
    should ever be saved as "pending".
    """
    if status not in VALID_STATUSES:
        raise ValueError(f"status must be one of {VALID_STATUSES}, got '{status}'")

    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document()
    payload = {
        "skill": skill,
        "topic": topic,
        "type": resource_type,
        "title": title,
        "url": url,
        "status": status,
        "source": source,
        "addedAt": SERVER_TIMESTAMP,
        "reviewedAt": SERVER_TIMESTAMP if status != "pending" else None,
    }
    doc_ref.set(payload)
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def list_resources(
    db, skill: str | None = None, topic: str | None = None, status: str | None = None,
) -> list[dict]:
    """
    Equality-filtered list, same simple-filter pattern as
    question_repository.py.

    IMPORTANT: `status` is NOT defaulted to "verified" here — the caller
    decides. Student-facing routes must explicitly pass status="verified"
    (see services/learning_content_service.py); admin review routes pass
    status="pending". This is deliberate rather than a safe default,
    so it's obvious at each call site which audience is being served.
    """
    docs = db.collection(settings.LEARNING_RESOURCES_COLLECTION).stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        if skill and data.get("skill") != skill:
            continue
        if topic and data.get("topic") != topic:
            continue
        if status and data.get("status") != status:
            continue
        results.append(data)
    return results


def update_resource_status(db, resource_id: str, new_status: str) -> dict:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"status must be one of {VALID_STATUSES}, got '{new_status}'")

    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id)
    doc_ref.update({"status": new_status, "reviewedAt": SERVER_TIMESTAMP})
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def delete_resource(db, resource_id: str) -> None:
    db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id).delete()
