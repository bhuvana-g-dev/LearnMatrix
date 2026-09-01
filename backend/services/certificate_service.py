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
        Learning Hub progress every time it's read, and flips an
        in_progress certificate to completed the moment every topic of
        every non-mastered skill has a submitted topic quiz — no
        separate "mark complete" step for the student, and no
        polling/cron job needed either, since it's checked live on read.

COMPLETION RULE (this revision): completion is driven by actual
Learning Hub progress, NOT by re-running the whole-skill diagnostic.
A skill already "mastered" on the original diagnostic needs no further
action (that's the point of MASTERED_MESSAGE — "no scheduled study").
Every "upcoming" and "not_assessed" skill, though, only counts once
EVERY one of its topics has a submitted topic_quiz_progress row for
this student (services/topic_quiz_service.py's submit_topic_quiz()).
Topics per skill come from the roadmap's saved compressedSyllabus
(services/syllabus_compression_service.py) — the exact same source the
frontend's Course Workspace sidebar uses, so "every topic ticked in
the sidebar" and "certificate completed" can never disagree. Roles
without topic-level seed data yet fall back to treating the whole
skill as ONE topic (topic name == skill name) — same fallback
buildCourseNavigator.js uses on the frontend.

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
from services.topic_quiz_repository import list_progress_by_uid


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


def _every_topic_completed(roadmap: dict, uid: str, db) -> bool:
    """True once every topic of every non-mastered skill in the roadmap
    has a submitted topic_quiz_progress row for this student. See
    module docstring's COMPLETION RULE for the fallback used when a
    skill has no topic-level seed data yet."""
    entries_needing_completion = [
        e for e in roadmap.get("entries", []) if e.get("status") != "mastered"
    ]
    if not entries_needing_completion:
        # Everything was already mastered on the original diagnostic —
        # nothing left in Learning Hub for this student to complete.
        return True

    compressed = roadmap.get("compressedSyllabus") or {}
    topics_by_skill = {s["skill"]: s.get("topics", []) for s in compressed.get("skills", [])}

    completed_pairs = {
        (row.get("Skill"), row.get("Topic")) for row in list_progress_by_uid(db, uid=uid)
    }

    for entry in entries_needing_completion:
        skill = entry["skill"]
        skill_topics = topics_by_skill.get(skill)
        # Fallback: no topic-level seed data for this skill yet — treat
        # the whole skill as one topic, same as buildCourseNavigator.js.
        topic_titles = [t["title"] for t in skill_topics] if skill_topics else [skill]

        for title in topic_titles:
            if (skill, title) not in completed_pairs:
                return False

    return True


def get_certificate_with_live_status(uid: str) -> dict | None:
    db = get_firestore_client()
    certificate = get_certificate(db, uid)

    if not certificate:
        # Self-heal, same pattern as the roadmap mastery recompute in
        # services/userProgressCache.js: a student can have an active
        # roadmap/career path with no certificate row yet — e.g. their
        # roadmap was generated before this feature shipped, or the
        # /ai/generate-roadmap call that created it didn't have a
        # non-empty `role` at the time (see routes/ai_assessment_routes.py's
        # `if role:` guard around issue_or_update_certificate). Rather
        # than permanently showing "start a career path" to someone who
        # already started one, lazily issue the missing certificate from
        # their existing roadmap the next time it's read.
        roadmap = get_roadmap(db, uid)
        role = (roadmap or {}).get("role")
        if not roadmap or not role:
            return None
        certificate = issue_or_update_certificate(
            uid=uid, course_name=role, role_id=roadmap.get("roleId"),
        )

    if certificate.get("status") == "completed":
        return certificate

    roadmap = get_roadmap(db, uid)
    if not roadmap:
        return certificate

    if _every_topic_completed(roadmap, uid, db):
        return update_certificate(
            db, uid,
            {"status": "completed", "completedOn": date.today().isoformat()},
        )

    return certificate
