"""
services/image_service.py

Looks up ONE relevant, license-free stock photo per slide-deck "text"
section via the Pexels API (https://www.pexels.com/api/) — used only
for "text" layout sections (see agents/slide_deck_agent.py); "list",
"comparison", and "process" sections already carry their own visual
weight from icon badges and multi-panel layout, so a photo there would
just compete for space rather than add anything.

Degrades gracefully everywhere: a missing/invalid PEXELS_API_KEY, a
search with no results, or any network hiccup all just mean "no photo
for this section" rather than failing deck generation — same pattern
as services/youtube_service.py's YOUTUBE_API_KEY handling.
"""

import requests

from config.settings import settings

PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"
REQUEST_TIMEOUT_SECONDS = 6
DOWNLOAD_TIMEOUT_SECONDS = 10


def find_photo_url(query: str) -> str | None:
    """Returns a Pexels photo URL matching `query`, or None if
    unavailable. This is deliberately a URL, not the image bytes — the
    in-app slide-deck preview only needs a URL for an <img> tag, so
    fetching the actual bytes (fetch_image_bytes, below) is deferred
    until a pptx/pdf is actually being built."""
    if not settings.PEXELS_API_KEY or not query or not query.strip():
        return None
    try:
        resp = requests.get(
            PEXELS_SEARCH_URL,
            headers={"Authorization": settings.PEXELS_API_KEY},
            params={"query": query.strip(), "per_page": 1, "orientation": "landscape"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        photos = resp.json().get("photos", [])
        if not photos:
            return None
        src = photos[0].get("src", {})
        return src.get("large") or src.get("medium") or src.get("original")
    except Exception:
        return None


def fetch_image_bytes(url: str) -> bytes | None:
    """Downloads the actual image bytes for embedding into a pptx/pdf.
    Kept separate from find_photo_url so a preview-only request never
    pays this download cost, and a from-content download only pays it
    once per section regardless of how many times the deck was
    previewed first."""
    if not url:
        return None
    try:
        resp = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS)
        resp.raise_for_status()
        return resp.content
    except Exception:
        return None
