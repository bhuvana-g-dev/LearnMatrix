"""
services/gamma_service.py

Optional PREMIUM slide deck path: sends raw text straight to Gamma's
public Generate API (https://developers.gamma.app/) and lets Gamma
design, illustrate, and render the whole deck server-side, instead of
our own SlideDeckAgent (agents/slide_deck_agent.py) + python-pptx
renderer (services/ppt_service.py) pipeline.

This is the "own editable renderer vs premium Gamma/Plus AI mode"
split — this module IS the premium mode. It never replaces the
existing free pipeline: settings.GAMMA_API_KEY unset means this whole
module is simply never called (see routes/slidedeck_routes.py).

Gamma's API is asynchronous:

    1. POST /v1.0/generations       -> {generationId}
    2. GET  /v1.0/generations/{id}  -> poll until status is
                                        "completed" or "failed"
    3. On success, the completed job's `exportUrl` (when exportAs was
       requested) or `gammaUrl` points to the result — we download
       exportUrl's bytes directly so the caller gets a ready-to-save
       PPTX/PDF, the same file shape ppt_service.py's own renderer
       already returns.

Deliberately NOT using Gamma's own theme/design intelligence for our
"design_type" system (VISUAL_DESIGN_TYPES etc. in slide_deck_service.py)
— Gamma decides its own layout end-to-end from inputText, which is the
whole point of paying for it instead of maintaining our own renderer.
"""

import time

import requests

from config.settings import settings


class GammaServiceError(Exception):
    pass


def is_configured() -> bool:
    """Whether the premium Gamma path is available at all — routes
    check this BEFORE offering the option to the frontend, so a
    deployment with no GAMMA_API_KEY set behaves exactly as it did
    before this module existed."""
    return bool(settings.GAMMA_API_KEY)


def _headers() -> dict:
    return {
        "X-API-KEY": settings.GAMMA_API_KEY,
        "Content-Type": "application/json",
    }


def _create_generation(text: str, label: str, export_as: str, num_cards: int | None) -> str:
    """POST /generations. Returns the new job's generationId.
    Raises GammaServiceError on any non-2xx response or network
    failure — same "no silent partial success" contract as
    agents/slide_deck_agent.py's own error type."""
    body = {
        "inputText": text,
        "textMode": "generate",
        "format": "presentation",
        "numCards": num_cards or settings.GAMMA_DEFAULT_NUM_CARDS,
        "exportAs": export_as,
        "additionalInstructions": (
            f"This is study material for {label}. Keep it clear and "
            "educational, aimed at a student learning the topic."
        ),
    }
    if settings.GAMMA_THEME_ID:
        body["themeId"] = settings.GAMMA_THEME_ID

    try:
        resp = requests.post(
            f"{settings.GAMMA_API_BASE_URL}/generations",
            headers=_headers(),
            json=body,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise GammaServiceError(f"Couldn't reach Gamma: {exc}") from exc

    if resp.status_code == 401:
        raise GammaServiceError("Gamma rejected the API key (401). Check GAMMA_API_KEY.")
    if resp.status_code == 402:
        raise GammaServiceError("Gamma account is out of credits (402).")
    if resp.status_code == 403:
        raise GammaServiceError("Gamma denied access (403) — check the plan/feature is enabled.")
    if not resp.ok:
        raise GammaServiceError(f"Gamma generation request failed ({resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    generation_id = data.get("generationId")
    if not generation_id:
        raise GammaServiceError("Gamma response had no generationId.")
    return generation_id


def _poll_generation(generation_id: str) -> dict:
    """GET /generations/{id} every GAMMA_POLL_INTERVAL_SECONDS until
    status is 'completed' or 'failed', up to GAMMA_POLL_TIMEOUT_SECONDS
    total. Returns the final job dict on success."""
    deadline = time.monotonic() + settings.GAMMA_POLL_TIMEOUT_SECONDS

    while True:
        try:
            resp = requests.get(
                f"{settings.GAMMA_API_BASE_URL}/generations/{generation_id}",
                headers=_headers(),
                timeout=20,
            )
        except requests.RequestException as exc:
            raise GammaServiceError(f"Couldn't reach Gamma while polling: {exc}") from exc

        if not resp.ok:
            raise GammaServiceError(f"Gamma status check failed ({resp.status_code}): {resp.text[:300]}")

        job = resp.json()
        status = job.get("status")

        if status == "completed":
            return job
        if status == "failed":
            raise GammaServiceError(f"Gamma generation failed: {job.get('error') or 'unknown error'}")

        if time.monotonic() >= deadline:
            raise GammaServiceError(
                f"Gamma generation timed out after {settings.GAMMA_POLL_TIMEOUT_SECONDS:.0f}s "
                "— it may still finish; try again shortly."
            )

        time.sleep(settings.GAMMA_POLL_INTERVAL_SECONDS)


def _download_export(export_url: str) -> bytes:
    try:
        resp = requests.get(export_url, timeout=60)
    except requests.RequestException as exc:
        raise GammaServiceError(f"Couldn't download the generated file: {exc}") from exc
    if not resp.ok:
        raise GammaServiceError(f"Couldn't download the generated file ({resp.status_code}).")
    return resp.content


def generate_deck_file(
    text: str,
    label: str = "this topic",
    export_as: str = "pptx",
    num_cards: int | None = None,
) -> tuple[bytes, str]:
    """Full pipeline: text -> Gamma generation -> polled to completion
    -> downloaded file bytes. Returns (file_bytes, gamma_url) — the
    gammaUrl is included so the caller can also offer "open/edit in
    Gamma" as a link, not just the raw file, since that's a big part
    of what makes Gamma worth paying for over a static download.

    Raises GammaServiceError at any stage (create, poll, timeout,
    download) — callers should treat this exactly like
    SlideDeckServiceError from the free pipeline (see
    routes/slidedeck_routes.py)."""
    if not is_configured():
        raise GammaServiceError("Gamma isn't configured on this server (GAMMA_API_KEY unset).")
    if not text or not text.strip():
        raise GammaServiceError("text must be non-empty.")
    if export_as not in ("pdf", "pptx", "png"):
        raise GammaServiceError(f"Unsupported export_as: {export_as!r}")

    generation_id = _create_generation(text.strip(), label, export_as, num_cards)
    job = _poll_generation(generation_id)

    export_url = job.get("exportUrl")
    if not export_url:
        raise GammaServiceError("Gamma finished but returned no exportUrl.")

    file_bytes = _download_export(export_url)
    return file_bytes, job.get("gammaUrl", "")
