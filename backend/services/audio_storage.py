"""
services/audio_storage.py

Persists rendered Audio Overview WAV files in Firebase Storage so that
reopening a saved Audio Overview from Studio history (routes/studio_routes.py)
can play back the EXACT audio that was generated, instead of paying for a
fresh Gemini TTS call every time a student revisits it (see
services/audio_overview_service.py's module docstring for why the audio
was never persisted before — a multi-minute WAV routinely blows past
Firestore's 1MiB document limit, which is exactly why this lives in
Storage, not Firestore).

Deliberately best-effort everywhere: every function here returns None on
any failure (no bucket configured, no network, permission error) rather
than raising. Nothing about "did the Audio Overview get generated for the
student right now" should ever depend on storage working — upload is a
side effect, and a failed upload just means the OLD re-synthesize-on-reopen
behavior kicks back in for that one artifact (see routes/audio_overview_routes.py
and routes/studio_routes.py, both of which already treat a missing/failed
storage path as "fall back to TTS").
"""

import logging
import uuid

from firebase.firebase_config import get_storage_bucket

logger = logging.getLogger(__name__)


def upload_audio(uid: str, session_id: str, wav_bytes: bytes) -> str | None:
    """Uploads one rendered Audio Overview WAV and returns its Storage
    blob path (to be saved alongside the script in the studio artifact),
    or None if storage isn't configured or the upload fails."""
    bucket = get_storage_bucket()
    if bucket is None or not wav_bytes:
        return None
    path = f"audio-overviews/{uid}/{session_id}/{uuid.uuid4().hex}.wav"
    try:
        blob = bucket.blob(path)
        blob.upload_from_string(wav_bytes, content_type="audio/wav")
        return path
    except Exception:
        logger.exception("audio_storage.upload_audio: upload failed, continuing without it")
        return None


def download_audio(path: str) -> bytes | None:
    """Downloads a previously-uploaded Audio Overview WAV by its Storage
    blob path, or None if storage isn't configured, the blob is missing,
    or the download fails — callers fall back to re-synthesizing."""
    bucket = get_storage_bucket()
    if bucket is None or not path:
        return None
    try:
        blob = bucket.blob(path)
        if not blob.exists():
            return None
        return blob.download_as_bytes()
    except Exception:
        logger.exception("audio_storage.download_audio: download failed, falling back to re-synthesize")
        return None
