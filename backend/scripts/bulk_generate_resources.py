"""
scripts/bulk_generate_resources.py

Sweeps every skill for a role (skill names come from
data/skill_syllabus_seed.py's SKILL_SYLLABUS keys — the syllabus tree
itself is no longer read for this) and runs
services/resource_review_service.generate_and_auto_verify() once per
(skill, band) across all four bands
(config/settings.py's VALID_RESOURCE_BANDS: fundamentals/application/
advanced/polish) — filling in articles/GitHub/practice/pdf/cheatsheet
AND videos, published immediately (no manual per-item review), same
trade-off reasoning as that function's docstring.

Usage:
    python -m scripts.bulk_generate_resources frontend --by you@example.com
    python -m scripts.bulk_generate_resources frontend --by you@example.com --dry-run
    python -m scripts.bulk_generate_resources --all --by you@example.com

--dry-run prints exactly which (skill, band) pairs would be processed
and how many already have verified resources (skipped by default — see
--force) without calling Gemini/YouTube or writing anything.

--force reprocesses (skill, band) pairs that already have verified
resources too (e.g. after improving the resource-suggestion prompt).
Default behavior skips any pair that already has at least one verified
resource, so re-running this after adding a couple of new skills
doesn't burn API quota regenerating everything from scratch.

Rate-limited with a short sleep between pairs — this fires 2 AI/API
calls per (skill, band) pair, across potentially dozens of skills x 4
bands for one role; a small delay avoids tripping Gemini/YouTube's
per-minute quota, matching AI_GENERATION_MAX_RETRIES's already-cautious
posture elsewhere in this codebase.
"""

import sys
import os
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from firebase.firebase_config import get_firestore_client
from config.settings import settings
from data.skill_syllabus_seed import SKILL_SYLLABUS, get_role_ids
from services.resource_repository import list_resources
from services.resource_review_service import generate_and_auto_verify

SLEEP_BETWEEN_PAIRS_SECONDS = 3
VALID_BANDS = settings.VALID_RESOURCE_BANDS


def already_has_verified_resources(db, skill: str, band: str) -> bool:
    return len(list_resources(db, skill=skill, band=band, status="verified")) > 0


def process_role(db, role_id: str, verified_by: str, dry_run: bool, force: bool):
    skills = list(SKILL_SYLLABUS.get(role_id, {}).keys())
    total_pairs = len(skills) * len(VALID_BANDS)
    print(f"\n=== Role '{role_id}': {len(skills)} skill(s), {total_pairs} (skill, band) pair(s) ===")

    processed, skipped, failed = 0, 0, 0

    for skill_name in skills:
        for band in VALID_BANDS:
            if not force and not dry_run and already_has_verified_resources(db, skill_name, band):
                print(f"  [skip: already has resources] {skill_name} / {band}")
                skipped += 1
                continue

            if dry_run:
                print(f"  [would process] {skill_name} / {band}")
                processed += 1
                continue

            print(f"  [processing] {skill_name} / {band} ...", end=" ", flush=True)
            try:
                result = generate_and_auto_verify(skill=skill_name, band=band, verified_by=verified_by)
                n = len(result["articles"]) + len(result["videos"])
                errs = f" (errors: {result['errors']})" if result["errors"] else ""
                print(f"{n} resource(s) added{errs}")
                processed += 1
            except Exception as exc:  # noqa: BLE001 — one bad pair shouldn't kill the whole sweep
                print(f"FAILED: {exc}")
                failed += 1

            time.sleep(SLEEP_BETWEEN_PAIRS_SECONDS)

    print(f"=== Role '{role_id}' done: {processed} processed, {skipped} skipped, {failed} failed ===")


def main():
    parser = argparse.ArgumentParser(description="Bulk-generate and auto-verify learning resources for a role.")
    parser.add_argument("role", nargs="?", help="Role id (e.g. frontend). Omit and use --all for every seeded role.")
    parser.add_argument("--all", action="store_true", help="Process every role in data/skill_syllabus_seed.py.")
    parser.add_argument("--by", required=True, help="Your email/username — recorded as verifiedBy on every resource created.")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no Gemini/YouTube calls, no writes.")
    parser.add_argument("--force", action="store_true", help="Reprocess (skill, band) pairs that already have verified resources.")
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
