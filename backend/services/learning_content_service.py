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

TOPIC vs RESOURCE_TOPIC: `topic` (positional) drives notes generation/
caching and may be a lesson-composited key (e.g. "Variables — Lesson 1",
see frontend lessonService.compositeTopicKey()) — that's fine, AI notes
are meant to vary per lesson. Admin-managed resources must NEVER be
matched against that composite key though, since they're verified once
per plain topic name and shared across every lesson in that topic. So
resource lookups use the separate `resource_topic` param (defaults to
`topic` when the caller has no lesson to compose in) — see
_resolve_resources_by_type() and get_topic_package() below.

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

SINGLE PRIMARY VIDEO (this revision): a learner should see ONE
recommended video for the current topic, not a wall of search results.
_select_primary_and_alternates() below picks that one video — an
admin's isPinned choice wins outright if one exists (an explicit human
judgment beats any heuristic); otherwise every candidate is scored
against the learner's CURRENT focus_band (services/focus_band.py's
"fundamentals"/"application"/"advanced"/"polish", already computed by
the Roadmap Agent per skill — reused here as-is, nothing new to
compute) using simple, explainable signals: title keywords that match
how detailed/concise a video for that band should be, a soft preferred-
duration range, and view count as a mild tiebreaker. This is
deliberately NOT an ML ranking model — same "instant, no external
dependency, fully explainable" reasoning as every other rule-based
piece of this app (see services/roadmap_service.py's docstring for the
original version of this argument). The rest of the candidates (from
whichever source won — admin-curated or live fallback) are still
returned as `alternateVideos`, so nothing is thrown away, just
de-emphasized behind a single clear recommendation.
"""

from firebase.firebase_config import get_firestore_client
from agents.notes_generation_agent import NotesGenerationAgent, NotesGenerationError
from services.notes_repository import get_cached_notes, save_notes, notes_cache_key
from services.resource_repository import list_resources, resolve_category
from services.youtube_service import search_videos, is_configured as youtube_is_configured, YouTubeServiceError
from utils.generation_lock import run_with_lock

RESOURCE_TYPES = ["video", "documentation", "article", "pdf", "cheatsheet", "practice", "github"]

# Biases the live YouTube search query itself toward the right kind of
# video for the learner's current focus_band, on top of the post-hoc
# scoring in _score_video_for_focus_band() below — two light touches
# rather than one, neither doing anything YouTube's own relevance
# ranking can't already work with.
FOCUS_BAND_QUERY_HINTS = {
    "fundamentals": "for beginners explained",
    "application": "tutorial",
    "advanced": "advanced",
    "polish": "quick overview",
}

FOCUS_BAND_TITLE_KEYWORDS = {
    "fundamentals": ["beginner", "basics", "introduction", "explained", "for beginners", "step by step", "full course"],
    "application": ["tutorial", "guide", "how to", "practical", "project", "example"],
    "advanced": ["advanced", "deep dive", "in depth", "internals", "under the hood", "expert"],
    "polish": ["quick", "crash course", "in 10 minutes", "summary", "revision", "cheat sheet", "recap"],
}

# Soft preferred duration range in seconds per band — a TIEBREAKER, not
# a filter. A great video outside this range is still shown; this only
# nudges the ranking when several reasonable candidates exist.
FOCUS_BAND_DURATION_RANGE = {
    "fundamentals": (600, 3600),  # 10-60 min: room for a thorough, from-scratch explanation
    "application": (300, 1500),  # 5-25 min: balanced, hands-on
    "advanced": (180, 900),  # 3-15 min: concise, assumes the fundamentals
    "polish": (60, 600),  # 1-10 min: quick refresher
}


class LearningContentError(Exception):
    pass


def _score_video_for_focus_band(video: dict, focus_band: str) -> float:
    """Higher is a better fit for this learner's current level. See
    module docstring for why this is rule-based, not ML."""
    title_lower = (video.get("title") or "").lower()
    score = sum(3 for kw in FOCUS_BAND_TITLE_KEYWORDS.get(focus_band, []) if kw in title_lower)

    lo, hi = FOCUS_BAND_DURATION_RANGE.get(focus_band, (0, 10**9))
    if lo <= (video.get("durationSeconds") or 0) <= hi:
        score += 2

    # Mild popularity tiebreaker (capped) — stops two keyword-tied
    # candidates from being an arbitrary coin flip, without letting raw
    # view count alone override actual topic/level fit.
    score += min((video.get("viewCount") or 0) / 100_000, 2)
    return score


def _select_primary_and_alternates(videos: list[dict], focus_band: str) -> tuple[dict | None, list[dict]]:
    """
    Returns (primary_video_or_None, remaining_videos). An admin's
    isPinned choice always wins outright — that's an explicit human
    decision, not something a heuristic should ever override. Otherwise
    the highest-scoring candidate for this learner's focus_band wins.
    """
    if not videos:
        return None, []

    pinned = [v for v in videos if v.get("isPinned")]
    if pinned:
        primary = pinned[0]
        return primary, [v for v in videos if v is not primary]

    ranked = sorted(videos, key=lambda v: _score_video_for_focus_band(v, focus_band), reverse=True)
    return ranked[0], ranked[1:]


def _resolve_resources_by_type(db, skill: str, resource_topic: str, focus_band: str) -> dict[str, list[dict]]:
    """
    Implements the priority order documented above:
    admin-curated verified -> YouTube live fallback (video only) -> [].

    `resource_topic` is deliberately a SEPARATE parameter from the
    `topic` used for notes generation/caching elsewhere in this module
    (get_topic_package() below) — see the module docstring's "TOPIC vs
    RESOURCE_TOPIC" note. Admin-managed resources are always matched on
    the plain topic name, never a lesson-composited key.

    Grouped by type up front (not left as one flat list) so the
    frontend can render the categorized sections directly without
    re-deriving the grouping itself. The "video" list here is still the
    FULL candidate pool (admin-curated or live-fetched) — get_topic_package()
    below is what narrows it down to one primary recommendation.
    """
    verified = list_resources(db, skill=skill, topic=resource_topic, status="verified", enabled_only=True)

    by_type: dict[str, list[dict]] = {t: [] for t in RESOURCE_TYPES}
    for r in verified:
        r_type = r.get("type")
        if r_type in by_type:
            by_type[r_type].append(r)

    if not by_type["video"] and youtube_is_configured():
        # Topic-first query, further biased by focus_band — the whole
        # point of this fallback is relevance to the SPECIFIC topic AND
        # level the learner is on, not a generic "{skill} tutorial"
        # search (see module docstring and the matching note in
        # services/resource_review_service.py's generate_youtube_suggestions()).
        query_hint = FOCUS_BAND_QUERY_HINTS.get(focus_band, "tutorial")
        try:
            live_videos = search_videos(f"{resource_topic} {skill} {query_hint}", max_results=6)
            by_type["video"] = [
                {
                    "id": f"youtube-live-{v['videoId']}",
                    "skill": skill,
                    "topic": resource_topic,
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


def _group_by_category(by_type: dict[str, list[dict]]) -> dict[str, list[dict]]:
    """
    The learner-facing Practice / Reference & Reading split (video is
    excluded — it's already surfaced separately as primaryVideo /
    alternateVideos, never folded into either category). Each
    resource's category is resolved the same way list_resources()
    already resolves it (stored value, or config/settings.py's
    type-based default), so a resource created before `category`
    existed still lands in the right section here with no data
    migration needed.
    """
    grouped: dict[str, list[dict]] = {"practice": [], "reference": []}
    for r_type, items in by_type.items():
        if r_type == "video":
            continue
        for r in items:
            cat = resolve_category(r_type, r.get("category"))
            if cat in grouped:
                grouped[cat].append(r)
    return grouped


def get_topic_package(skill: str, topic: str, focus_band: str, resource_topic: str | None = None) -> dict:
    """
    `topic` drives AI-generated notes (may be a lesson-composited key,
    e.g. lessonService.compositeTopicKey() on the frontend — that's
    fine, notes are meant to be scoped per-lesson). `resource_topic`
    drives admin-managed resource matching and defaults to `topic` when
    not given (e.g. the non-lesson learning flow, where there's only
    ever one plain topic name to begin with). Callers that DO thread a
    composite key through `topic` (CourseWorkspaceScreen.jsx's lesson
    view) must pass the plain topic name as `resource_topic` — see
    routes/learning_routes.py's `?resourceTopic=` query param.
    """
    db = get_firestore_client()
    resource_topic = resource_topic or topic

    notes = get_cached_notes(db, skill, topic, focus_band)
    was_cached = notes is not None

    if notes is None:
        # Two students opening the same never-before-cached (skill,
        # topic, focusBand) at nearly the same moment would otherwise
        # both fall through to a Gemini call here — the lock collapses
        # that into one real generation; the loser waits for/reuses the
        # winner's saved result instead of duplicating the call. See
        # utils/generation_lock.py's module docstring.
        def _generate_and_save() -> dict:
            agent = NotesGenerationAgent()
            try:
                generated = agent.run(skill=skill, topic=topic, focus_band=focus_band)
            except NotesGenerationError as exc:
                raise LearningContentError(
                    f"Couldn't generate notes for '{skill} / {topic}' ({focus_band}): {exc}"
                ) from exc
            return save_notes(db, skill, topic, focus_band, generated)

        notes = run_with_lock(
            db,
            lock_key=f"notes__{notes_cache_key(skill, topic, focus_band)}",
            check_fn=lambda: get_cached_notes(db, skill, topic, focus_band),
            generate_and_save_fn=_generate_and_save,
        )

    resources_by_type = _resolve_resources_by_type(db, skill, resource_topic, focus_band)
    primary_video, alternate_videos = _select_primary_and_alternates(resources_by_type["video"], focus_band)
    resources_by_category = _group_by_category(resources_by_type)

    # Flat list preserved alongside the grouped one — existing behavior,
    # existing field, untouched shape/order (skips empty categories'
    # placeholders since they're just []). Nothing that already reads
    # pkg.resources breaks; resourcesByType/resourcesByCategory/
    # primaryVideo/alternateVideos are purely additive.
    flat_resources = [r for resources in resources_by_type.values() for r in resources]

    return {
        "skill": skill,
        "topic": topic,
        "resourceTopic": resource_topic,
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
        "resourcesByCategory": resources_by_category,  # {"practice": [...], "reference": [...]} — video excluded
        "primaryVideo": primary_video,  # the ONE recommended video — always this, never a list, in the primary UI
        "alternateVideos": alternate_videos,  # everything else, for an optional secondary "More Resources" view
    }
