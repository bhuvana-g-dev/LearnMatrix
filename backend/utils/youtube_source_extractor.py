"""
utils/youtube_source_extractor.py

Turns a YouTube video URL into plain text (its transcript/captions),
before chunking (text_chunker.py) and embedding (embedding_service.py)
— the YouTube-as-a-source counterpart to source_text_extractor.py,
which does the same job for uploaded files.

Two network calls, no API key needed for either:
  1. youtube-transcript-api pulls the caption track (auto-generated
     captions work fine — most lecture/tutorial videos have them).
  2. YouTube's public oEmbed endpoint gets the video's title, so the
     source list shows something readable instead of a raw video ID.
"""

import re

import requests
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

OEMBED_URL = "https://www.youtube.com/oembed"

_VIDEO_ID_PATTERNS = [
    r"(?:v=|\/videos\/|embed\/|youtu\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})",
]


class YoutubeExtractionError(Exception):
    """Raised when the URL isn't a recognizable YouTube link, or the
    video has no transcript/captions available to index."""


def extract_video_id(url: str) -> str:
    for pattern in _VIDEO_ID_PATTERNS:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    # Bare 11-char ID pasted directly, no surrounding URL.
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", url.strip()):
        return url.strip()
    raise YoutubeExtractionError("That doesn't look like a valid YouTube link.")


def fetch_youtube_source(url: str) -> dict:
    """Returns {"videoId", "title", "text"}. Raises
    YoutubeExtractionError if the link is invalid or has no usable
    transcript."""
    video_id = extract_video_id(url)

    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
    except (NoTranscriptFound, TranscriptsDisabled):
        raise YoutubeExtractionError(
            "This video doesn't have captions/transcript available to read from."
        )
    except VideoUnavailable:
        raise YoutubeExtractionError("Couldn't find that video — check the link.")
    except Exception as exc:  # noqa: BLE001
        raise YoutubeExtractionError(f"Couldn't fetch this video's transcript: {exc}") from exc

    text = " ".join(chunk["text"] for chunk in transcript if chunk.get("text")).strip()
    if not text:
        raise YoutubeExtractionError("This video's transcript came back empty.")

    return {"videoId": video_id, "title": _fetch_title(url, video_id), "text": text}


def _fetch_title(url: str, video_id: str) -> str:
    try:
        resp = requests.get(OEMBED_URL, params={"url": url, "format": "json"}, timeout=8)
        resp.raise_for_status()
        title = resp.json().get("title")
        if title:
            return title
    except Exception:  # noqa: BLE001
        pass
    return f"YouTube video ({video_id})"
