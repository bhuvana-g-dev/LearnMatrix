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
"""

from firebase.firebase_config import get_firestore_client
from agents.resource_suggestion_agent import ResourceSuggestionAgent, ResourceSuggestionError
from services.resource_repository import (
    add_resource, list_resources, update_resource_status,
    update_resource, set_pinned, set_enabled,
)
from services.youtube_service import search_videos, YouTubeServiceError


class ResourceReviewError(Exception):
    pass


def generate_pending_suggestions(skill: str, topic: str, count: int = 5) -> list[dict]:
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
        suggestions = agent.run(skill=skill, topic=topic, count=count)
    except ResourceSuggestionError as exc:
        raise ResourceReviewError(
            f"Couldn't generate resource suggestions for '{skill} / {topic}': {exc}"
        ) from exc

    db = get_firestore_client()
    saved = []
    for s in suggestions:
        saved.append(
            add_resource(
                db, skill=skill, topic=topic, resource_type=s["type"],
                title=s["title"], url=s["url"],
                status="pending", source="ai_suggested",
            )
        )
    return saved


def generate_youtube_suggestions(skill: str, topic: str, count: int = 6) -> list[dict]:
    """
    The video counterpart to generate_pending_suggestions() — real
    YouTube Data API v3 results (services/youtube_service.py) rather
    than an LLM guessing a URL, saved with status="pending" so an admin
    still judges QUALITY/fit before it ever reaches a student, same
    review gate as every other suggestion source. Every result here is
    guaranteed to be a real, currently-existing video; nothing about
    "does this URL exist" needs checking, only "is this actually a good
    video for this topic".

    Query is deliberately topic-first ("{topic} {skill} tutorial"), not
    just the skill name — the whole point of this feature is per-topic
    relevance, not generic skill-level results (see
    services/learning_content_service.py's matching fallback logic).
    """
    try:
        videos = search_videos(f"{topic} {skill} tutorial", max_results=count)
    except YouTubeServiceError as exc:
        raise ResourceReviewError(
            f"Couldn't search YouTube for '{skill} / {topic}': {exc}"
        ) from exc

    if not videos:
        return []

    db = get_firestore_client()
    saved = []
    for v in videos:
        saved.append(
            add_resource(
                db, skill=skill, topic=topic, resource_type="video",
                title=v["title"], url=v["url"],
                status="pending", source="youtube_api",
                thumbnail=v["thumbnail"], channel_name=v["channelName"],
                duration_seconds=v["durationSeconds"], view_count=v["viewCount"],
                published_at=v["publishedAt"],
            )
        )
    return saved


def get_pending_queue(skill: str | None = None, topic: str | None = None) -> list[dict]:
    """The admin review queue — everything awaiting a human decision."""
    db = get_firestore_client()
    return list_resources(db, skill=skill, topic=topic, status="pending")


def verify_resource(resource_id: str) -> dict:
    """Admin confirmed this link is real and a good fit — now visible to students."""
    db = get_firestore_client()
    return update_resource_status(db, resource_id, "verified")


def reject_resource(resource_id: str) -> dict:
    """
    Admin confirmed this link is bad (broken, wrong, low quality).
    Kept in Firestore with status="rejected" rather than deleted, so a
    future re-generation of suggestions for the same topic doesn't
    silently resurrect something already known to be bad — a route
    could later filter generate_pending_suggestions() against existing
    rejected URLs to avoid re-suggesting them (not built yet, but the
    status is preserved specifically so that's possible).
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
