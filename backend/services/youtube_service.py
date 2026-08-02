"""
services/youtube_service.py

Thin client for the YouTube Data API v3 — the ONLY module that talks to
YouTube directly. Two calls chained together (search.list then
videos.list) because search.list alone doesn't return duration or exact
view counts; only videos.list does.

Deliberately NOT Firestore-aware — this returns plain video dicts,
nothing more. Two different callers use it for two different purposes:

  - services/resource_review_service.py: admin clicks "Search YouTube"
    for a skill/topic -> real results saved as status="pending" for
    human review, same curation workflow as
    agents/resource_suggestion_agent.py's suggestions. This is the
    CURATION path.
  - services/learning_content_service.py: called LIVE, per student
    request, only when zero verified video resources exist for that
    skill/topic. Nothing from this path is ever saved to Firestore, so
    a missing/invalid key or a quota error only ever means "no live
    fallback videos this time" — never a broken page, never unreviewed
    data landing in the database. This is the FALLBACK path.

Uses plain `requests` (already a dependency) rather than adding
google-api-python-client — this only needs two read-only REST calls,
not the full client SDK's surface area.

Requires YOUTUBE_API_KEY (config/settings.py, read from the
YOUTUBE_API_KEY environment variable there — never hardcoded here or
anywhere else, same rule as every other key in this codebase).
"""

import re

import requests

from config.settings import settings

SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
REQUEST_TIMEOUT_SECONDS = 8

_ISO_DURATION_RE = re.compile(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


class YouTubeServiceError(Exception):
    """
    Raised for ANY failure — missing key, network error, quota
    exceeded, malformed response. Deliberately one broad exception type
    rather than several: every call site treats every failure mode
    identically (catch it, degrade gracefully, never let it become a
    500 or a broken page — see module docstring).
    """


def _parse_duration(iso_duration: str) -> int:
    """
    Converts an ISO 8601 duration like 'PT14M8S' to whole seconds.
    YouTube never returns days/months/years for a video, only
    hours/minutes/seconds, so that's all this covers. Malformed/empty
    input returns 0 rather than raising — a missing duration shouldn't
    fail the whole video result.
    """
    match = _ISO_DURATION_RE.match(iso_duration or "")
    if not match:
        return 0
    hours, minutes, seconds = (int(g) if g else 0 for g in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def is_configured() -> bool:
    """Lets callers check before trying, instead of always paying for a
    try/except — used by learning_content_service.py to skip the live
    fallback attempt entirely when there's no key at all."""
    return bool(settings.YOUTUBE_API_KEY)


def search_videos(query: str, max_results: int = 6) -> list[dict]:
    """
    Searches YouTube for `query`, returns real video metadata only —
    every field here came back from YouTube's own API, nothing is
    invented:

        videoId, url, title, channelName, thumbnail, durationSeconds,
        viewCount, publishedAt

    Raises YouTubeServiceError on ANY failure (missing key, network
    error, bad response, quota exceeded). Always catch this at the call
    site — see module docstring for why neither caller ever lets this
    propagate to a student-facing 500.
    """
    if not settings.YOUTUBE_API_KEY:
        raise YouTubeServiceError("YOUTUBE_API_KEY is not configured.")
    if not query or not query.strip():
        raise YouTubeServiceError("query must not be empty.")
    if not (1 <= max_results <= 25):
        raise YouTubeServiceError("max_results must be between 1 and 25.")

    try:
        search_resp = requests.get(
            SEARCH_URL,
            params={
                "part": "snippet",
                "q": query,
                "type": "video",
                "maxResults": max_results,
                "relevanceLanguage": "en",
                "safeSearch": "strict",
                "videoEmbeddable": "true",
                "key": settings.YOUTUBE_API_KEY,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        search_resp.raise_for_status()
        search_data = search_resp.json()
    except requests.RequestException as exc:
        raise YouTubeServiceError(f"YouTube search request failed: {exc}") from exc
    except ValueError as exc:  # response wasn't valid JSON
        raise YouTubeServiceError(f"YouTube search returned an unexpected response: {exc}") from exc

    video_ids = [
        item["id"]["videoId"]
        for item in search_data.get("items", [])
        if item.get("id", {}).get("videoId")
    ]
    if not video_ids:
        return []

    try:
        videos_resp = requests.get(
            VIDEOS_URL,
            params={
                "part": "snippet,contentDetails,statistics",
                "id": ",".join(video_ids),
                "key": settings.YOUTUBE_API_KEY,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        videos_resp.raise_for_status()
        videos_data = videos_resp.json()
    except requests.RequestException as exc:
        raise YouTubeServiceError(f"YouTube video-details request failed: {exc}") from exc
    except ValueError as exc:
        raise YouTubeServiceError(f"YouTube video-details returned an unexpected response: {exc}") from exc

    results = []
    for item in videos_data.get("items", []):
        video_id = item.get("id")
        if not video_id:
            continue
        snippet = item.get("snippet", {})
        content_details = item.get("contentDetails", {})
        statistics = item.get("statistics", {})
        thumbnails = snippet.get("thumbnails", {})
        thumbnail = (
            thumbnails.get("medium", {}).get("url")
            or thumbnails.get("default", {}).get("url")
            or ""
        )
        results.append({
            "videoId": video_id,
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "title": snippet.get("title", "Untitled"),
            "channelName": snippet.get("channelTitle", ""),
            "thumbnail": thumbnail,
            "durationSeconds": _parse_duration(content_details.get("duration", "")),
            "viewCount": int(statistics.get("viewCount", 0) or 0),
            "publishedAt": snippet.get("publishedAt", ""),
        })
    return results
