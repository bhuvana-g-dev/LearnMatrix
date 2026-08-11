"""
scripts/bulk_generate_resources.py

Sweeps every topic seeded in data/skill_syllabus_seed.py for a role and
runs services/resource_review_service.generate_and_auto_verify() on
each — filling in articles/GitHub/practice/pdf/cheatsheet AND videos,
published immediately (no manual per-topic review), same trade-off
reasoning as that function's docstring.

Usage:
    python -m scripts.bulk_generate_resources frontend --by you@example.com
    python -m scripts.bulk_generate_resources frontend --by you@example.com --dry-run
    python -m scripts.bulk_generate_resources --all --by you@example.com

--dry-run prints exactly which (skill, topic) pairs would be processed
and how many already have verified resources (skipped by default — see
--force) without calling Gemini/YouTube or writing anything.

--force reprocesses topics that already have verified resources too
(e.g. after improving the resource-suggestion prompt). Default behavior
skips any topic that already has at least one verified resource, so
re-running this after adding a couple of new skills doesn't burn API
quota regenerating everything from scratch.

Rate-limited with a short sleep between topics — this fires 2 AI/API
calls per topic (agent + YouTube search), across potentially 150+
topics for one role; a small delay avoids tripping Gemini/YouTube's
per-minute quota, matching AI_GENERATION_MAX_RETRIES's already-cautious
posture elsewhere in this codebase.
"""

import sys
import os
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from firebase.firebase_config import get_firestore_client
from data.skill_syllabus_seed import SKILL_SYLLABUS, get_role_ids
from services.resource_repository import list_resources
from services.resource_review_service import generate_and_auto_verify

SLEEP_BETWEEN_TOPICS_SECONDS = 3


def already_has_verified_resources(db, skill: str, topic: str) -> bool:
    return len(list_resources(db, skill=skill, topic=topic, status="verified")) > 0


def process_role(db, role_id: str, verified_by: str, dry_run: bool, force: bool):
    skills = SKILL_SYLLABUS.get(role_id, {})
    total_topics = sum(len(topics) for topics in skills.values())
    print(f"\n=== Role '{role_id}': {len(skills)} skill(s), {total_topics} topic(s) ===")

    processed, skipped, failed = 0, 0, 0

    for skill_name, topic_rows in skills.items():
        for row in topic_rows:
            topic_title = row["Title"]

            if not force and not dry_run and already_has_verified_resources(db, skill_name, topic_title):
                print(f"  [skip: already has resources] {skill_name} / {topic_title}")
                skipped += 1
                continue

            if dry_run:
                print(f"  [would process] {skill_name} / {topic_title}")
                processed += 1
                continue

            print(f"  [processing] {skill_name} / {topic_title} ...", end=" ", flush=True)
            try:
                result = generate_and_auto_verify(skill=skill_name, topic=topic_title, verified_by=verified_by)
                n = len(result["articles"]) + len(result["videos"])
                errs = f" (errors: {result['errors']})" if result["errors"] else ""
                print(f"{n} resource(s) added{errs}")
                processed += 1
            except Exception as exc:  # noqa: BLE001 — one bad topic shouldn't kill the whole sweep
                print(f"FAILED: {exc}")
                failed += 1

            time.sleep(SLEEP_BETWEEN_TOPICS_SECONDS)

    print(f"=== Role '{role_id}' done: {processed} processed, {skipped} skipped, {failed} failed ===")


def main():
    parser = argparse.ArgumentParser(description="Bulk-generate and auto-verify learning resources for a role.")
    parser.add_argument("role", nargs="?", help="Role id (e.g. frontend). Omit and use --all for every seeded role.")
    parser.add_argument("--all", action="store_true", help="Process every role in data/skill_syllabus_seed.py.")
    parser.add_argument("--by", required=True, help="Your email/username — recorded as verifiedBy on every resource created.")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no Gemini/YouTube calls, no writes.")
    parser.add_argument("--force", action="store_true", help="Reprocess topics that already have verified resources.")
    args = parser.parse_args()

    available = get_role_ids()
    if args.all:
        roles = available
    elif args.role:
        if args.role not in available:
            print(f"'{args.role}' not found. Available roles: {available}")
            sys.exit(1)
        roles = [args.role]
    else:
        print(f"Provide a role or --all. Available roles: {available}")
        sys.exit(1)

    db = get_firestore_client()  # needed even in dry-run mode, to check existing resources
    for role_id in roles:
        process_role(db, role_id, verified_by=args.by, dry_run=args.dry_run, force=args.force)


if __name__ == "__main__":
    main()
