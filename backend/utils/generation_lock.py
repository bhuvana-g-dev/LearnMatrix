"""
utils/generation_lock.py

Cross-process best-effort lock for "cache miss -> call Gemini -> save"
sequences (services/learning_content_service.py's notes generation,
services/topic_quiz_service.py's topic quiz generation,
services/lesson_service.py's lesson plan generation).

Problem: two requests hitting the exact same cache key at the same
moment (two students opening the same never-before-seen topic within
milliseconds of each other, e.g.) both see a cache miss and both fire
a Gemini call — the second call is pure waste, since whichever save
finishes last just overwrites the first with an equivalent result.

Fix: a short-lived Firestore "lock" document, created with `.create()`
(atomic — fails with AlreadyExists if another process already holds
it). The loser polls the REAL cache location (not the lock) until the
winner's save shows up, or gives up after a bounded wait and generates
itself anyway (fail-open — a slow winner should never turn into a
frozen page for the loser; a rare double-generation is still strictly
better than any request ever hanging).

This is deliberately NOT a queue, NOT a distributed mutex library, and
NOT relied on for correctness (final Firestore state is safe either
way — last-write-wins on an idempotent, deterministic doc ID) — purely
a cost-saving measure to collapse near-simultaneous duplicate AI calls
into one.
"""

import time
import uuid

LOCK_COLLECTION = "generation_locks"
DEFAULT_WAIT_TIMEOUT_SECONDS = 20
DEFAULT_POLL_INTERVAL_SECONDS = 0.5
# Stale-lock safety net — a holder that crashed/died mid-generation
# shouldn't block everyone forever. Anything older than this is treated
# as abandoned and can be stolen by the next caller.
DEFAULT_LOCK_TTL_SECONDS = 30


def _is_stale(lock_data: dict) -> bool:
    created_at = lock_data.get("createdAtEpoch", 0)
    return (time.time() - created_at) > DEFAULT_LOCK_TTL_SECONDS


def try_acquire(db, lock_key: str) -> str | None:
    """Attempts to atomically create the lock doc. Returns a token
    string if acquired (pass it to release()), or None if someone else
    already holds a live lock. Never raises — a Firestore hiccup here
    just means "didn't get the lock", which safely falls back to the
    normal (always-generate) behavior.

    Deliberately catches a bare `Exception` on the `.create()` call
    rather than importing google.api_core's AlreadyExists specifically
    — `.create()`'s failure mode for "doc already exists" is stable
    across firestore client versions, and this avoids adding a direct
    import dependency on a sub-package firebase-admin only pulls in
    transitively."""
    doc_ref = db.collection(LOCK_COLLECTION).document(lock_key)
    token = uuid.uuid4().hex
    try:
        doc_ref.create({"token": token, "createdAtEpoch": time.time()})
        return token
    except Exception:  # noqa: BLE001 — see docstring above
        try:
            snap = doc_ref.get()
            if snap.exists and _is_stale(snap.to_dict() or {}):
                doc_ref.delete()
                doc_ref.create({"token": token, "createdAtEpoch": time.time()})
                return token
        except Exception:  # noqa: BLE001 — best-effort only
            pass
        return None


def release(db, lock_key: str, token: str) -> None:
    """Deletes the lock doc, but only if we still own it (token
    matches) — avoids deleting a lock someone else already stole after
    ours went stale. Never raises."""
    doc_ref = db.collection(LOCK_COLLECTION).document(lock_key)
    try:
        snap = doc_ref.get()
        if snap.exists and (snap.to_dict() or {}).get("token") == token:
            doc_ref.delete()
    except Exception:  # noqa: BLE001 — best-effort only
        pass


def run_with_lock(db, lock_key: str, check_fn, generate_and_save_fn):
    """
    High-level helper used by every cache-miss-triggers-Gemini call
    site. Caller has ALREADY checked the cache once and gotten a miss
    before calling this.

    `check_fn()` re-reads the cache — called again here only after
    losing the acquire race, since the winner may have finished by
    then. `generate_and_save_fn()` does the actual Gemini call +
    Firestore save and returns the result.

    Returns whatever `check_fn()` or `generate_and_save_fn()` returns.
    """
    token = try_acquire(db, lock_key)

    if token is not None:
        try:
            return generate_and_save_fn()
        finally:
            release(db, lock_key, token)

    # Someone else is generating this exact key right now — poll the
    # real cache instead of firing a redundant duplicate call.
    deadline = time.time() + DEFAULT_WAIT_TIMEOUT_SECONDS
    while time.time() < deadline:
        time.sleep(DEFAULT_POLL_INTERVAL_SECONDS)
        cached = check_fn()
        if cached is not None:
            return cached

    # Fail-open: the other side is taking too long (or died holding a
    # not-yet-stale lock) — generate ourselves rather than hang the
    # request. Worst case this is exactly the "duplicate call" we were
    # trying to avoid, never a broken page.
    return generate_and_save_fn()
