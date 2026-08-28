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
                 fit, low quality). Kept (not deleted) so the same bad
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

`verifiedBy` — email/username of whoever is responsible for a
"verified" resource being live: whoever clicked Verify in the review
queue, or the identity passed to a bulk auto-verify run (see
resource_review_service.generate_and_auto_verify() /
scripts/bulk_generate_resources.py). Empty string for "pending"/
"rejected" resources. Display/audit only, shown next to the Verified
badge in the Resource Bank — nothing reads it to gate access.

`band` — SKILL-LEVEL, not topic-level. One of config/settings.py's
VALID_RESOURCE_BANDS (fundamentals/application/advanced/polish), the
same vocabulary services/focus_band.py already computes per topic quiz
attempt. A resource is created for (skill, band); a learner sees it
when their current focus_band for that skill matches. There is
deliberately no `topic` field anymore — see
services/learning_content_service.py's module docstring for the
matching change this replaces.

    learning_resources/{resourceId}
        skill, band ("fundamentals"|"application"|"advanced"|"polish"),
        type ("video"|"documentation"|"article"|"pdf"|"cheatsheet"|
        "practice"|"github"), category ("practice"|"reference"|None —
        None only for type="video"; see resolve_category() below for
        the type-based default used when this is unset), title, url,
        status, source ("ai_suggested"|"youtube_api"|"manual"),
        description, isPinned, enabled, verifiedBy, thumbnail,
        channelName, durationSeconds, viewCount, publishedAt
        (video-only metadata, "" / 0 / None for non-video types),
        addedAt, reviewedAt, updatedAt
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP
VALID_STATUSES = settings.VALID_RESOURCE_STATUSES
VALID_TYPES = settings.VALID_RESOURCE_TYPES
VALID_BANDS = settings.VALID_RESOURCE_BANDS
VALID_CATEGORIES = settings.VALID_RESOURCE_CATEGORIES
DEFAULT_CATEGORY_BY_TYPE = settings.DEFAULT_CATEGORY_BY_TYPE


def resolve_category(resource_type: str, category: str | None = None) -> str | None:
    """
    The stored `category` if there is one; otherwise a sensible default
    derived from `type` (see config/settings.py's DEFAULT_CATEGORY_BY_TYPE)
    so resources saved before `category` existed keep grouping correctly
    on both the admin Resource Management tabs and the learner skill
    page, with no data migration needed. Returns None for "video" (and
    any other type with no default) — video is its own thing, never
    part of the Practice / Reference & Reading split.
    """
    if category:
        return category
    return DEFAULT_CATEGORY_BY_TYPE.get(resource_type)


def add_resource(
    db, skill: str, band: str, resource_type: str, title: str, url: str,
    status: str = "verified", source: str = "manual",
    description: str = "", is_pinned: bool = False,
    thumbnail: str = "", channel_name: str = "", duration_seconds: int = 0,
    view_count: int = 0, published_at: str = "", verified_by: str = "",
    category: str | None = None,
) -> dict:
    """
    Default status="verified" because a resource typed in directly by an
    admin (source="manual") has already been implicitly checked by the
    person adding it — only AI/YouTube-suggested resources
    (source="ai_suggested" / "youtube_api") should ever be saved as
    "pending".

    verified_by: email/username of whoever is responsible for this
    resource being live — an admin manually adding one (status=
    "verified" default), or the identity passed by a bulk auto-verify
    run (see services/resource_review_service.py's
    generate_and_auto_verify()). Empty string for anything saved as
    "pending" (nobody has verified it yet). Purely a display/audit
    field — the Resource Bank shows "Verified by {verifiedBy}" next to
    the badge; nothing reads this to make access decisions.

    category: "practice" | "reference" | None (None only makes sense
    for resource_type == "video"). Not required — omitted/blank falls
    back to resolve_category()'s type-based default, same as reading a
    resource created before this field existed.

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
    if band not in VALID_BANDS:
        raise ValueError(f"band must be one of {VALID_BANDS}, got '{band}'")
    if category is not None and category not in VALID_CATEGORIES:
        raise ValueError(f"category must be one of {VALID_CATEGORIES} or None, got '{category}'")

    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document()
    payload = {
        "skill": skill,
        "band": band,
        "type": resource_type,
        "category": resolve_category(resource_type, category),
        "title": title,
        "url": url,
        "status": status,
        "source": source,
        "description": description,
        "isPinned": is_pinned,
        "enabled": True,
        "thumbnail": thumbnail,
        "channelName": channel_name,
        "durationSeconds": duration_seconds,
        "viewCount": view_count,
        "publishedAt": published_at,
        "verifiedBy": verified_by if status == "verified" else "",
        "addedAt": SERVER_TIMESTAMP,
        "reviewedAt": SERVER_TIMESTAMP if status != "pending" else None,
        "updatedAt": SERVER_TIMESTAMP,
    }
    doc_ref.set(payload)
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def list_resources(
    db, skill: str | None = None, band: str | None = None, status: str | None = None,
    resource_type: str | None = None,
    enabled_only: bool = False, category: str | None = None,
) -> list[dict]:
    """
    Firestore-filtered list, same `.where()`-chaining pattern as
    question_repository.py. All filter params are additive (AND'd
    together) and default to "no filter" — existing call sites that
    only pass skill/status keep working unchanged, and the return
    shape/ordering is identical to before.

    IMPORTANT: `status` is NOT defaulted to "verified" here — the caller
    decides. Student-facing routes must explicitly pass status="verified"
    (see services/learning_content_service.py); admin review routes pass
    status="pending". This is deliberate rather than a safe default,
    so it's obvious at each call site which audience is being served.

    `skill`/`band`/`status`/`type` are pushed down as Firestore `.where()`
    clauses — these fields are always set by add_resource() (never
    missing on any document, old or new), so filtering at the query
    level instead of in Python is a pure performance change: only
    matching documents are read/counted against quota, nothing about
    which resources match is different.

    `category` is ALSO pushed down as a `.where()` clause. This is only
    safe because scripts/backfill_resource_categories.py has been run
    (see that script) so every existing document has a real `category`
    value (or explicit None for videos) instead of a missing field —
    Firestore's `.where("category", "==", ...)` does not match documents
    where the field is absent, unlike the old Python-side
    resolve_category() fallback. Do not add new resource fields that
    rely on a similar Python-side default-if-missing pattern and then
    push them into `.where()` without the same kind of backfill first.

    `enabled_only=True` additionally excludes resources explicitly
    disabled by an admin (enabled is False) — missing/None `enabled` is
    treated as enabled (True), so resources created before this field
    existed are unaffected. Student-facing calls should pass True;
    admin list views should leave it False so disabled resources still
    show up (with their disabled state visible) for re-enabling. This
    stays a Python-side check (not a `.where()`) precisely because
    "missing == True" can't be expressed as a single equality filter —
    it only runs over the already-narrowed result set above, not the
    full collection, so it doesn't reintroduce the original problem.
    """
    query = db.collection(settings.LEARNING_RESOURCES_COLLECTION)
    if skill:
        query = query.where("skill", "==", skill)
    if band:
        query = query.where("band", "==", band)
    if status:
        query = query.where("status", "==", status)
    if resource_type:
        query = query.where("type", "==", resource_type)
    if category:
        query = query.where("category", "==", category)

    results = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        data["category"] = resolve_category(data.get("type"), data.get("category"))
        if enabled_only and data.get("enabled") is False:
            continue
        results.append(data)

    # Pinned resources first, otherwise unchanged (Firestore's default
    # stream order) — a simple, explainable ordering rather than any
    # relevance scoring or a date-sort that isn't actually implemented.
    results.sort(key=lambda r: (not r.get("isPinned", False),))
    return results


def update_resource_status(db, resource_id: str, new_status: str, verified_by: str = "") -> dict:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"status must be one of {VALID_STATUSES}, got '{new_status}'")

    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id)
    updates = {"status": new_status, "reviewedAt": SERVER_TIMESTAMP, "updatedAt": SERVER_TIMESTAMP}
    if new_status == "verified":
        updates["verifiedBy"] = verified_by
    doc_ref.update(updates)
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def update_resource(db, resource_id: str, updates: dict) -> dict:
    """
    General field edit for an existing resource — title/url/type/skill/
    band/description, whatever the admin changed in the edit form.
    Deliberately separate from update_resource_status() (that one is
    specifically the pending->verified/rejected review action, kept
    narrow on purpose) and from set_pinned()/set_enabled() (those are
    single-purpose toggles, not general edits).

    `updates` keys are whitelisted here rather than written through
    as-is — this is the one write path an admin's raw form input reaches,
    so it's also where a bad `type`/`band` value gets caught before it
    corrupts a document, and where fields like `status` or `addedAt`
    can't be smuggled in through an edit form.
    """
    editable_fields = {"skill", "band", "type", "title", "url", "description", "category"}
    payload = {k: v for k, v in updates.items() if k in editable_fields}

    if "type" in payload and payload["type"] not in VALID_TYPES:
        raise ValueError(f"type must be one of {VALID_TYPES}, got '{payload['type']}'")
    if "band" in payload and payload["band"] not in VALID_BANDS:
        raise ValueError(f"band must be one of {VALID_BANDS}, got '{payload['band']}'")
    if "category" in payload and payload["category"] is not None and payload["category"] not in VALID_CATEGORIES:
        raise ValueError(f"category must be one of {VALID_CATEGORIES} or None, got '{payload['category']}'")
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
