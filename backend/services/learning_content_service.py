"""
services/learning_content_service.py

The actual "brain" of the Learning System's content delivery
(LEARNING_SYSTEM_ARCHITECTURE.md §3). Given (skill, topic, focus_band):

  1. Check services/notes_repository.py for a cached AI-generated
     notes set at that exact key.
  2. Cache miss -> call NotesGenerationAgent, save the result, then
     continue as if it had been a cache hit. Cache hit -> skip
     generation entirely (no AI call, no cost, instant response).
  3. Fetch resources for the same (skill, topic) — see
     _resolve_resources_by_type() below for the actual priority order.
  4. Return one assembled "Topic Package" — the single object the
     frontend needs to render a learning session.

This is the ONLY service allowed to combine notes + resources — routes
call this, not the two repositories directly, so there's one place that
knows "how a topic page is assembled" instead of that logic leaking into
route handlers.

RESOURCE PRIORITY ORDER (this revision):

    1. Admin-curated VERIFIED Firestore resources for this exact
       (skill, topic) — always tried first, for every resource type.
    2. ONLY for the "video" category, and ONLY when step 1 returned zero
       videos: a LIVE YouTube Data API v3 search
       (services/youtube_service.py), scoped to this exact topic (not
       just the skill — see the query built below). These results are
       NEVER written to Firestore; they're assembled fresh per request
       and shown for that session only. If the API key is missing or
       the call fails for any reason, this step is skipped entirely —
       caught here, never re-raised — and the video category is simply
       empty rather than the whole page failing.
    3. If both steps produced nothing for a category, the frontend
       shows "No learning resources available." for that category —
       there is no third data source; an empty category is a legitimate,
       expected state, not an error.

Other categories (documentation/article/pdf/cheatsheet/practice/github)
only ever come from step 1 — the live-search fallback is video-only,
matching the actual ask (YouTube Data API only covers video).
"""

from firebase.firebase_config import get_firestore_client
from agents.notes_generation_agent import NotesGenerationAgent, NotesGenerationError
from services.notes_repository import get_cached_notes, save_notes
from services.resource_repository import list_resources
from services.youtube_service import search_videos, is_configured as youtube_is_configured, YouTubeServiceError

RESOURCE_TYPES = ["video", "documentation", "article", "pdf", "cheatsheet", "practice", "github"]


class LearningContentError(Exception):
    pass


def _resolve_resources_by_type(db, skill: str, topic: str) -> dict[str, list[dict]]:
    """
    Implements the priority order documented above:
    admin-curated verified -> YouTube live fallback (video only) -> [].

    Grouped by type up front (not left as one flat list) so the
    frontend can render the 6 categorized sections directly without
    re-deriving the grouping itself.
    """
    verified = list_resources(db, skill=skill, topic=topic, status="verified", enabled_only=True)

    by_type: dict[str, list[dict]] = {t: [] for t in RESOURCE_TYPES}
    for r in verified:
        r_type = r.get("type")
        if r_type in by_type:
            by_type[r_type].append(r)

    if not by_type["video"] and youtube_is_configured():
        # Topic-first query — the whole point of this fallback is
        # relevance to the SPECIFIC topic the learner is on, not a
        # generic "{skill} tutorial" search (see module docstring and
        # the matching note in services/resource_review_service.py's
        # generate_youtube_suggestions()).
        try:
            live_videos = search_videos(f"{topic} {skill} tutorial", max_results=6)
            by_type["video"] = [
                {
                    "id": f"youtube-live-{v['videoId']}",
                    "skill": skill,
                    "topic": topic,
                    "type": "video",
                    "title": v["title"],
                    "url": v["url"],
                    "thumbnail": v["thumbnail"],
                    "channelName": v["channelName"],
                    "durationSeconds": v["durationSeconds"],
                    "viewCount": v["viewCount"],
                    "publishedAt": v["publishedAt"],
                    "difficulty": None,
                    "isPinned": False,
                    "source": "youtube_live",  # lets the frontend distinguish, if it ever wants to
                }
                for v in live_videos
            ]
        except YouTubeServiceError:
            # Exactly the required behavior: missing key / API failure
            # -> fall back to whatever admin-curated resources exist
            # (already assigned above, unaffected by this) -> the page
            # never breaks, this category is just empty this time.
            pass

    return by_type


def get_topic_package(skill: str, topic: str, focus_band: str) -> dict:
    db = get_firestore_client()

    notes = get_cached_notes(db, skill, topic, focus_band)
    was_cached = notes is not None

    if notes is None:
        agent = NotesGenerationAgent()
        try:
            generated = agent.run(skill=skill, topic=topic, focus_band=focus_band)
        except NotesGenerationError as exc:
            raise LearningContentError(
                f"Couldn't generate notes for '{skill} / {topic}' ({focus_band}): {exc}"
            ) from exc
        notes = save_notes(db, skill, topic, focus_band, generated)

    resources_by_type = _resolve_resources_by_type(db, skill, topic)
    # Flat list preserved alongside the grouped one — existing behavior,
    # existing field, untouched shape/order (skips empty categories'
    # placeholders since they're just []). Nothing that already reads
    # pkg.resources breaks; resourcesByType is purely additive.
    flat_resources = [r for resources in resources_by_type.values() for r in resources]

    return {
        "skill": skill,
        "topic": topic,
        "focusBand": focus_band,
        "notes": {
            "title": notes["title"],
            "summary": notes["summary"],
            "sections": notes["sections"],
            "codeExample": notes.get("codeExample", ""),
            "keyTakeaways": notes["keyTakeaways"],
        },
        "notesFromCache": was_cached,  # useful for debugging/demoing the caching behavior
        "resources": flat_resources,
        "resourcesByType": resources_by_type,
    }
