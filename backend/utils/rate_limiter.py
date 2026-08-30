"""
utils/rate_limiter.py

One shared Flask-Limiter instance, applied per-route in the AI-calling
route files (ai_chat_routes.py, ai_assessment_routes.py,
slidedeck_routes.py, mindmap_routes.py, audio_overview_routes.py,
flashcard_routes.py, learning_routes.py's AI-suggest endpoints). These
are the routes that spend real Gemini/Groq API quota per call, so
they're the ones that need a ceiling — without one, a single client
(malicious or just a buggy retry loop) could run up the AI provider
bill with no backend-side limit at all.

Storage: in-memory (the default), which is correct for Render's single
free-tier instance this app deploys to today. If this ever runs as
more than one worker/instance, switch storage_uri to a shared Redis
instance (see Flask-Limiter docs) — in-memory counters don't sync
across processes.

Key function: rate-limits per signed-in uid when we can determine one
(from the URL path or the JSON body — the same two places
utils/user_auth.py looks), falling back to the client's IP for
requests with no uid at all. Per-uid is what actually stops one
account from hammering the AI providers; per-IP alone is easy to
route around and would also unfairly throttle everyone behind the
same NAT/college wifi.
"""

from flask import request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


def _rate_limit_key() -> str:
    uid = request.view_args.get("uid") if request.view_args else None
    if not uid:
        payload = request.get_json(silent=True) or {}
        uid = payload.get("uid")
    return f"uid:{uid}" if uid else f"ip:{get_remote_address()}"


limiter = Limiter(
    key_func=_rate_limit_key,
    default_limits=[],  # no blanket default — each AI route sets its own
    storage_uri="memory://",
)
