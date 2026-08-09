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
human verifies" workflow: agents/resource_suggestion_agent.py and
services/youtube_service.py's admin-search path can both produce a
wrong/low-quality suggestion, but nothing either one produces is ever
visible to a student until a human explicitly flips it to "verified".

`enabled` is a SEPARATE toggle from `status` — a verified resource can
be temporarily hidden (enabled=False) without losing its verified
status/history, e.g. a video went private. Re-enabling doesn't require
re-review. Missing/None is treated as enabled=True everywhere this is
read, so every resource created before this field existed keeps working
exactly as before.

    learning_resources/{resourceId}
        skill, topic, type ("video"|"documentation"|"article"|"pdf"|
        "cheatsheet"|"practice"|"github"), title, url, status, source
        ("ai_suggested"|"youtube_api"|"manual"), difficulty
        ("Beginner"|"Intermediate"|"Advanced"|None), description,
        isPinned, enabled, thumbnail, channelName, durationSeconds,
        viewCount, publishedAt (video-only metadata, "" / 0 / None for
        non-video types), addedAt, reviewedAt, updatedAt
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP
VALID_STATUSES = settings.VALID_RESOURCE_STATUSES
VALID_TYPES = settings.VALID_RESOURCE_TYPES
VALID_DIFFICULTIES = settings.VALID_TOPIC_DIFFICULTIES  # reuses the existing Beginner/Intermediate/Advanced scale


def add_resource(
    db, skill: str, topic: str, resource_type: str, title: str, url: str,
    status: str = "verified", source: str = "manual",
    difficulty: str | None = None, description: str = "", is_pinned: bool = False,
    thumbnail: str = "", channel_name: str = "", duration_seconds: int = 0,
    view_count: int = 0, published_at: str = "",
) -> dict:
    """
    Default status="verified" because a resource typed in directly by an
    admin (source="manual") has already been implicitly checked by the
    person adding it — only AI/YouTube-suggested resources
    (source="ai_suggested" / "youtube_api") should ever be saved as
    "pending".

    The video-metadata params (thumbnail/channel_name/duration_seconds/
    view_count/published_at) are meaningless for non-video types and
    default to empty/zero — callers only pass them when resource_type
    == "video" (see services/youtube_service.py's result shape, which
    lines up field-for-field with these).
    """
    if status not in VALID_STATUSES:
        raise ValueError(f"status must be one of {VALID_STATUSES}, got '{status}'")
    if resource_type not in VALID_TYPES:
        raise ValueError(f"type must be one of {VALID_TYPES}, got '{resource_type}'")
    if difficulty is not None and difficulty not in VALID_DIFFICULTIES:
        raise ValueError(f"difficulty must be one of {VALID_DIFFICULTIES} or None, got '{difficulty}'")

    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document()
    payload = {
        "skill": skill,
        "topic": topic,
        "type": resource_type,
        "title": title,
        "url": url,
        "status": status,
        "source": source,
        "difficulty": difficulty,
        "description": description,
        "isPinned": is_pinned,
        "enabled": True,
        "thumbnail": thumbnail,
        "channelName": channel_name,
        "durationSeconds": duration_seconds,
        "viewCount": view_count,
        "publishedAt": published_at,
        "addedAt": SERVER_TIMESTAMP,
        "reviewedAt": SERVER_TIMESTAMP if status != "pending" else None,
        "updatedAt": SERVER_TIMESTAMP,
    }
    doc_ref.set(payload)
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def list_resources(
    db, skill: str | None = None, topic: str | None = None, status: str | None = None,
    resource_type: str | None = None, difficulty: str | None = None,
    enabled_only: bool = False,
) -> list[dict]:
    """
    Equality-filtered list, same simple-filter pattern as
    question_repository.py. All filter params are additive (AND'd
    together) and default to "no filter" — existing call sites that
    only pass skill/topic/status keep working unchanged.

    IMPORTANT: `status` is NOT defaulted to "verified" here — the caller
    decides. Student-facing routes must explicitly pass status="verified"
    (see services/learning_content_service.py); admin review routes pass
    status="pending". This is deliberate rather than a safe default,
    so it's obvious at each call site which audience is being served.

    `enabled_only=True` additionally excludes resources explicitly
    disabled by an admin (enabled is False) — missing/None `enabled` is
    treated as enabled (True), so resources created before this field
    existed are unaffected. Student-facing calls should pass True;
    admin list views should leave it False so disabled resources still
    show up (with their disabled state visible) for re-enabling.
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
        if resource_type and data.get("type") != resource_type:
            continue
        if difficulty and data.get("difficulty") != difficulty:
            continue
        if enabled_only and data.get("enabled") is False:
            continue
        results.append(data)

    # Pinned resources first, otherwise unchanged (Firestore's default
    # stream order) — a simple, explainable ordering rather than any
    # relevance scoring or a date-sort that isn't actually implemented.
    results.sort(key=lambda r: (not r.get("isPinned", False),))
    return results


def update_resource_status(db, resource_id: str, new_status: str) -> dict:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"status must be one of {VALID_STATUSES}, got '{new_status}'")

    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id)
    doc_ref.update({"status": new_status, "reviewedAt": SERVER_TIMESTAMP, "updatedAt": SERVER_TIMESTAMP})
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def update_resource(db, resource_id: str, updates: dict) -> dict:
    """
    General field edit for an existing resource — title/url/type/skill/
    topic/difficulty/description, whatever the admin changed in the
    edit form. Deliberately separate from update_resource_status() (that
    one is specifically the pending->verified/rejected review action,
    kept narrow on purpose) and from set_pinned()/set_enabled() (those
    are single-purpose toggles, not general edits).

    `updates` keys are whitelisted here rather than written through
    as-is — this is the one write path an admin's raw form input reaches,
    so it's also where a bad `type`/`difficulty` value gets caught
    before it corrupts a document, and where fields like `status` or
    `addedAt` can't be smuggled in through an edit form.
    """
    editable_fields = {"skill", "topic", "type", "title", "url", "difficulty", "description"}
    payload = {k: v for k, v in updates.items() if k in editable_fields}

    if "type" in payload and payload["type"] not in VALID_TYPES:
        raise ValueError(f"type must be one of {VALID_TYPES}, got '{payload['type']}'")
    if "difficulty" in payload and payload["difficulty"] is not None and payload["difficulty"] not in VALID_DIFFICULTIES:
        raise ValueError(f"difficulty must be one of {VALID_DIFFICULTIES} or None, got '{payload['difficulty']}'")
    if not payload:
        raise ValueError(f"No editable field(s) in update. Editable fields: {sorted(editable_fields)}")

    payload["updatedAt"] = SERVER_TIMESTAMP
    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id)
    doc_ref.update(payload)
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def set_pinned(db, resource_id: str, is_pinned: bool) -> dict:
    """Pinned resources are shown first on the student side (see
    list_resources()'s sort) — for "this is the one video we most want
    a learner to watch" without removing the alternatives."""
    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id)
    doc_ref.update({"isPinned": bool(is_pinned), "updatedAt": SERVER_TIMESTAMP})
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def set_enabled(db, resource_id: str, enabled: bool) -> dict:
    """Hides/unhides a resource from students WITHOUT touching its
    verified/rejected status or requiring re-review — see module
    docstring's `enabled` vs `status` distinction."""
    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id)
    doc_ref.update({"enabled": bool(enabled), "updatedAt": SERVER_TIMESTAMP})
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def delete_resource(db, resource_id: str) -> None:
    db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id).delete()
