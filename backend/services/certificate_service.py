"""
services/certificate_service.py

Certificate lifecycle, tied directly to the SAME roadmap a student is
already working through (services/roadmap_service.py) — deliberately no
separate "certificate progress" concept to keep in sync by hand.

    issue_or_update_certificate(...)  called once, right after a roadmap
        is generated and saved (routes/ai_assessment_routes.py). Starts
        a fresh "in_progress" certificate the first time a student picks
        a career path, or when they switch to a different one. Re-
        generating a roadmap for the SAME career path (e.g. a retake)
        leaves an existing certificate untouched — it never downgrades a
        completed certificate back to in_progress.

    get_certificate_with_live_status(...)  called on every
        GET /api/certificates/<uid>. Re-checks the student's CURRENT
        roadmap completion (roadmap.masteredCount == roadmap.totalSkills)
        every time it's read, and flips an in_progress certificate to
        completed the moment that becomes true — no separate "mark
        complete" step for the student, and no polling/cron job needed
        either, since it's checked live on read.

Deliberately NOT stored: the student's name. The certificate only ever
carries courseName/status/dates — the frontend fills in the name from
the SAME profile data already shown elsewhere on the page (see
frontend/src/hooks/useProfileDashboard.js), so it can never go stale
relative to the student's actual current profile name.
"""

import random
from datetime import date

from firebase.firebase_config import get_firestore_client
from services.certificate_repository import get_certificate, save_certificate, update_certificate
from services.roadmap_repository import get_roadmap


def _new_certificate_id() -> str:
    return f"LMX-{date.today().year}-{random.randint(10000, 99999)}"


def issue_or_update_certificate(uid: str, course_name: str, role_id: str | None) -> dict:
    db = get_firestore_client()
    existing = get_certificate(db, uid)

    if existing and existing.get("courseName") == course_name:
        # Same career path re-generating its roadmap (e.g. a retake) —
        # leave the existing certificate (and any completed status)
        # exactly as it is.
        return existing

    # First certificate ever, or the student switched career paths —
    # start (or restart) a fresh in_progress certificate for the new
    # course. Matches roadmap_repository.save_roadmap()'s own "a new
    # one fully replaces the previous one" rule.
    return save_certificate(
        db, uid,
        {
            "courseName": course_name,
            "roleId": role_id,
            "certificateId": _new_certificate_id(),
            "status": "in_progress",
            "startedOn": date.today().isoformat(),
            "completedOn": None,
        },
    )


def get_certificate_with_live_status(uid: str) -> dict | None:
    db = get_firestore_client()
    certificate = get_certificate(db, uid)
    if not certificate:
        return None

    if certificate.get("status") == "completed":
        return certificate

    roadmap = get_roadmap(db, uid)
    total = roadmap.get("totalSkills", 0) if roadmap else 0
    mastered = roadmap.get("masteredCount", 0) if roadmap else 0

    if roadmap and total > 0 and mastered >= total:
        return update_certificate(
            db, uid,
            {"status": "completed", "completedOn": date.today().isoformat()},
        )

    return certificate
