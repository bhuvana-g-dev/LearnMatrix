"""
scripts/upload_skill_topics.py

The ONLY script that writes data/skill_syllabus_seed.py into Firestore.
This is the sole entry point into the `skill_topics` collection for
syllabus DATA (routes only ever read it, never write it) — same
"script writes, service reads" separation as scripts/upload_questions.py.

Runtime flow this script implements:

    data/skill_syllabus_seed.py --> upload_skill_topics.py --> Firestore --> Flask APIs --> React

Usage
-----
    python -m scripts.upload_skill_topics frontend           # one role
    python -m scripts.upload_skill_topics --all               # every seeded role
    python -m scripts.upload_skill_topics frontend --dry-run

--dry-run prints exactly what WOULD happen (creates/updates/deactivations)
without writing to Firestore. Omit --dry-run to actually write.

Per-role workflow
------------------
1. Read every topic row for the role from SKILL_SYLLABUS
   (data/skill_syllabus_seed.py), grouped by skill.
2. Convert each row into a SkillTopic (models/skill_topic_model.py).
3. For each skill, UPSERT every topic into Firestore keyed by TopicID
   (services/skill_topic_repository.upsert_topic):
     - TopicID not in Firestore yet -> create; CreatedAt = UpdatedAt = now.
     - TopicID already in Firestore -> update; CreatedAt untouched,
       UpdatedAt = now.
4. SOFT DELETE: any TopicID that exists in Firestore for that Skill but
   was NOT present in this seed run (i.e. removed from the seed file)
   has its Status flipped to Inactive. The document itself is never
   removed (services/skill_topic_repository.deactivate_missing_topics).

Adding a new role later means adding a new entry to SKILL_SYLLABUS in
the seed file and running this script with that role's id — nothing
here hardcodes "frontend".
"""

import sys
import argparse
from collections import defaultdict

from firebase.firebase_config import get_firestore_client
from models.skill_topic_model import SkillTopic
from services.skill_topic_repository import upsert_topic, deactivate_missing_topics
from data.skill_syllabus_seed import get_role_ids, get_skills_for_role, iter_seed_rows


def process_role(db, role_id: str, dry_run: bool) -> None:
    print(f"\n=== Role: {role_id} ===")

    rows = list(iter_seed_rows(role_id))
    if not rows:
        print(f"  No seed rows found for role '{role_id}'. Skipping.")
        return

    topics = [SkillTopic.from_seed(row) for row in rows]

    by_skill: dict[str, list[SkillTopic]] = defaultdict(list)
    for t in topics:
        by_skill[t.Skill].append(t)

    print(f"  Read {len(topics)} topic(s) across {len(by_skill)} skill(s) for '{role_id}'.")

    if dry_run:
        for skill, skill_topics in by_skill.items():
            print(f"    [dry-run] {skill}: would upsert {len(skill_topics)} topic(s)")
        print(f"  [dry-run] {len(topics)} topic(s) would be upserted for '{role_id}'.")
        print("  [dry-run] soft-delete check skipped in dry-run.")
        return

    created = updated = 0
    for skill, skill_topics in by_skill.items():
        ids_in_seed = {t.TopicID for t in skill_topics}

        for t in skill_topics:
            result = upsert_topic(db, t.to_upload_dict())
            if result == "created":
                created += 1
            else:
                updated += 1

        deactivated = deactivate_missing_topics(db, skill, ids_in_seed)
        if deactivated:
            print(f"    {skill}: soft-deleted (missing from seed): {deactivated}")

    print(f"  Upserted: {created} created, {updated} updated.")


def main():
    parser = argparse.ArgumentParser(
        description="Upsert the Skill Syllabus Tree seed data into Firestore, "
        "soft-deleting any topic removed from the seed file."
    )
    parser.add_argument(
        "role",
        nargs="?",
        help="Role id matching a key in data/skill_syllabus_seed.SKILL_SYLLABUS "
        "(e.g. frontend). Omit and use --all to process every seeded role.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process every role currently seeded in data/skill_syllabus_seed.py.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and preview only. Do NOT write to Firestore.",
    )
    args = parser.parse_args()

    available = get_role_ids()
    if not available:
        print("No roles found in data/skill_syllabus_seed.py. Nothing to do.")
        sys.exit(1)

    if args.all:
        roles = available
    elif args.role:
        if args.role not in available:
            print(f"'{args.role}' not found. Available roles: {available}")
            sys.exit(1)
        roles = [args.role]
    else:
        roles = [available[0]]
        print(f"No role given — defaulting to '{roles[0]}'. Use --all for every seeded role.")

    db = None if args.dry_run else get_firestore_client()

    for role_id in roles:
        process_role(db, role_id, args.dry_run)


if __name__ == "__main__":
    main()
