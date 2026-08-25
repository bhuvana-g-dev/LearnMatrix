"""
services/resource_review_service.py

Orchestrates the "AI suggests, human verifies" workflow requested by
the team, sitting on top of agents/resource_suggestion_agent.py and
services/resource_repository.py.

Kept separate from services/learning_content_service.py deliberately:
that file is entirely about STUDENT-facing content assembly (always
reads status="verified" only); this file is entirely ADMIN-facing
(generates pending suggestions, lists them for review, flips their
status). Mixing the two into one file would make it easy to
accidentally leak an unverified suggestion into the student path —
keeping them apart makes that mistake structurally harder to make.

Every function here works at (skill, band) — fundamentals/application/
advanced/polish, config/settings.py's VALID_RESOURCE_BANDS — not
(skill, topic). See services/resource_repository.py's module docstring
for why resources no longer carry a topic.
"""

from firebase.firebase_config import get_firestore_client
from agents.resource_suggestion_agent import ResourceSuggestionAgent, ResourceSuggestionError
from services.resource_repository import (
    add_resource, list_resources, update_resource_status,
    update_resource, set_pinned, set_enabled,
)
from services.youtube_service import search_videos, YouTubeServiceError

# Biases the YouTube search query toward the right kind of video for a
# band — same hint vocabulary services/learning_content_service.py uses
# for the live per-request fallback, reused here for the admin's
# "Search Only" / bulk-generate video search so both paths ask YouTube
# for the same kind of thing.
BAND_QUERY_HINTS = {
    "fundamentals": "for beginners explained",
    "application": "tutorial",
    "advanced": "advanced",
    "polish": "quick overview",
}


class ResourceReviewError(Exception):
    pass


def generate_pending_suggestions(skill: str, band: str, count: int = 5) -> list[dict]:
    """
    Calls the Resource Suggestion Agent (documentation/article/github/
    pdf/cheatsheet/practice only — see agents/resource_suggestion_agent.py's
    UPDATE note on why "video" isn't part of this anymore) and saves
    every result with status="pending" — none of these are visible to
    students (services/learning_content_service.py only ever reads
    status="verified") until reviewed via verify_resource()/reject_resource().
    """
    agent = ResourceSuggestionAgent()
    try:
        suggestions = agent.run(skill=skill, band=band, count=count)
    except ResourceSuggestionError as exc:
        raise ResourceReviewError(
            f"Couldn't generate resource suggestions for '{skill}' ({band}): {exc}"
        ) from exc

    db = get_firestore_client()
    saved = []
    for s in suggestions:
        saved.append(
            add_resource(
                db, skill=skill, band=band, resource_type=s["type"],
                title=s["title"], url=s["url"],
                status="pending", source="ai_suggested",
            )
        )
    return saved


def generate_youtube_suggestions(skill: str, band: str, count: int = 6) -> list[dict]:
    """
    The video counterpart to generate_pending_suggestions() — real
    YouTube Data API v3 results (services/youtube_service.py) rather
    than an LLM guessing a URL, saved with status="pending" so an admin
    still judges QUALITY/fit before it ever reaches a student, same
    review gate as every other suggestion source. Every result here is
    guaranteed to be a real, currently-existing video; nothing about
    "does this URL exist" needs checking, only "is this actually a good
    video for this skill at this level".
    """
    query_hint = BAND_QUERY_HINTS.get(band, "tutorial")
    try:
        videos = search_videos(f"{skill} {query_hint}", max_results=count)
    except YouTubeServiceError as exc:
        raise ResourceReviewError(
            f"Couldn't search YouTube for '{skill}' ({band}): {exc}"
        ) from exc

    if not videos:
        return []

    db = get_firestore_client()
    saved = []
    for v in videos:
        saved.append(
            add_resource(
                db, skill=skill, band=band, resource_type="video",
                title=v["title"], url=v["url"],
                status="pending", source="youtube_api",
                thumbnail=v["thumbnail"], channel_name=v["channelName"],
                duration_seconds=v["durationSeconds"], view_count=v["viewCount"],
                published_at=v["publishedAt"],
            )
        )
    return saved


def generate_and_auto_verify(
    skill: str, band: str, verified_by: str,
    article_count: int = 5, video_count: int = 4,
) -> dict:
    """
    The bulk-seeding counterpart to generate_pending_suggestions() +
    generate_youtube_suggestions(): generates BOTH non-video resources
    (via the AI agent) and videos (via real YouTube search) for one
    (skill, band), but saves every result straight to status="verified"
    instead of "pending" — skipping the one-by-one manual review queue
    entirely.

    verified_by exists specifically so every resource this creates is
    still attributable to whoever ran the bulk job (see
    scripts/bulk_generate_resources.py), and every one still goes
    through Resource Bank's normal unverify/edit/disable/delete tools
    afterward — this trades "human reviews before publish" for "human
    can review after publish", it doesn't remove the ability to review
    at all.

    Used by: scripts/bulk_generate_resources.py (whole-role CLI sweep)
    and POST /api/admin/learning-resources/bulk-generate-and-verify
    (single skill+band, triggered from the Resource Bank UI).
    """
    db = get_firestore_client()
    created = {"skill": skill, "band": band, "articles": [], "videos": [], "errors": []}

    # VIDEO-ONLY MODE: article_count <= 0 means "skip article/GitHub/
    # cheatsheet generation entirely" (used by the Resource Bank's
    # "Generate & Publish Video" action — see ResourceBankScreen.jsx).
    # Guarded here rather than left to fall through to the agent call
    # below: ResourceSuggestionAgent.run() requires 1 <= count <= 10 and
    # raises for count=0, which would otherwise land a confusing
    # "count must be between 1 and 10" line in created["errors"] on
    # every video-only run, even though nothing actually went wrong.
    try:
        if article_count > 0:
            agent = ResourceSuggestionAgent()
            suggestions = agent.run(skill=skill, band=band, count=article_count)
            for s in suggestions:
                created["articles"].append(
                    add_resource(
                        db, skill=skill, band=band, resource_type=s["type"],
                        title=s["title"], url=s["url"],
                        status="verified", source="ai_suggested", verified_by=verified_by,
                    )
                )
    except ResourceSuggestionError as exc:
        created["errors"].append(f"article/github generation: {exc}")

    try:
        query_hint = BAND_QUERY_HINTS.get(band, "tutorial")
        videos = search_videos(f"{skill} {query_hint}", max_results=video_count)
        for v in videos:
            created["videos"].append(
                add_resource(
                    db, skill=skill, band=band, resource_type="video",
                    title=v["title"], url=v["url"],
                    status="verified", source="youtube_api", verified_by=verified_by,
                    thumbnail=v["thumbnail"], channel_name=v["channelName"],
                    duration_seconds=v["durationSeconds"], view_count=v["viewCount"],
                    published_at=v["publishedAt"],
                )
            )
    except YouTubeServiceError as exc:
        created["errors"].append(f"video search: {exc}")

    return created


def get_pending_queue(skill: str | None = None, band: str | None = None) -> list[dict]:
    """The admin review queue — everything awaiting a human decision."""
    db = get_firestore_client()
    return list_resources(db, skill=skill, band=band, status="pending")


def verify_resource(resource_id: str, verified_by: str = "") -> dict:
    """Admin confirmed this link is real and a good fit — now visible to
    students. verified_by (email/username) is recorded for the audit
    trail shown in the Resource Bank (see resource_repository.py's
    module docstring)."""
    db = get_firestore_client()
    return update_resource_status(db, resource_id, "verified", verified_by=verified_by)


def unverify_resource(resource_id: str) -> dict:
    """
    Pulls an already-verified resource back OUT of student view without
    marking it "rejected" (rejected implies the link is bad/wrong — this
    is for "this is fine, I just don't want it live right now"). Moves
    status back to "pending", which is enough on its own: student-facing
    routes (services/learning_content_service.py) only ever read
    status="verified", so a "pending" resource is immediately invisible
    to students. It also lands back in the review queue
    (get_pending_queue() below), so it's easy to re-verify later instead
    of being lost.
    """
    db = get_firestore_client()
    return update_resource_status(db, resource_id, "pending")


def reject_resource(resource_id: str) -> dict:
    """
    Admin confirmed this link is bad (broken, wrong, low quality).
    Kept in Firestore with status="rejected" rather than deleted, so a
    future re-generation of suggestions for the same (skill, band)
    doesn't silently resurrect something already known to be bad.
    """
    db = get_firestore_client()
    return update_resource_status(db, resource_id, "rejected")


def edit_resource(resource_id: str, updates: dict) -> dict:
    """Admin-facing wrapper for resource_repository.update_resource() —
    kept here (not called directly from routes) so every admin write to
    this collection goes through this one service file."""
    db = get_firestore_client()
    return update_resource(db, resource_id, updates)


def pin_resource(resource_id: str, is_pinned: bool) -> dict:
    db = get_firestore_client()
    return set_pinned(db, resource_id, is_pinned)


def set_resource_enabled(resource_id: str, enabled: bool) -> dict:
    db = get_firestore_client()
    return set_enabled(db, resource_id, enabled)
