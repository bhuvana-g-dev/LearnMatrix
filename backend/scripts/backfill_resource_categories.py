"""
scripts/backfill_resource_categories.py

One-time migration so services/resource_repository.py's list_resources()
can push `category` down into a Firestore `.where()` clause instead of
filtering in Python.

Why this is needed:
    Old `learning_resources` documents (created before the `category`
    field existed) simply don't have that field stored. Firestore's
    `.where("category", "==", "practice")` does NOT match a document
    where the field is missing — only resolve_category()'s Python-side
    fallback did. Without this backfill, switching to a Firestore-side
    category filter would make old (but still verified/valid) resources
    silently disappear from filtered lists — the documents stay in the
    DB untouched, they'd just stop showing up.

What this script does, per document in `learning_resources`:
    - If `category` is already set (a real value) -> left alone, not
      touched at all, not even re-written.
    - If `category` is missing or None -> set it to
      resolve_category(type, None), i.e. exactly the same value the
      old Python fallback would have computed at read time. For type
      == "video" that default is None, so the doc is written with an
      explicit `category: None` rather than a missing field (an
      explicit None still won't match `.where("category", "==", ...)`,
      which is correct — videos were never part of the Practice/
      Reference split).
    - No other field is ever read or written. `skill`, `band`,
      `status`, `type`, `title`, `url`, `enabled`, `verifiedBy`,
      `isPinned`, timestamps, etc. are all left exactly as they are —
      this script cannot demote/delete/hide a verified resource, only
      add the one missing field.

Usage:
    # Dry run (default) — reports counts, writes nothing:
    python -m scripts.backfill_resource_categories

    # Actually apply the backfill:
    python -m scripts.backfill_resource_categories --apply

    # After applying, confirm nothing is left missing (should print 0):
    python -m scripts.backfill_resource_categories --verify
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from firebase.firebase_config import get_firestore_client
from config.settings import settings
from services.resource_repository import resolve_category

BATCH_SIZE = 400  # Firestore batch write hard limit is 500; leave headroom.


def _category_is_missing(data: dict) -> bool:
    """True when `category` is either absent from the document or
    stored as None — both cases resolve_category() currently papers
    over at read time."""
    return data.get("category") is None


def find_missing(db):
    """Returns (total_docs, [(doc_id, resource_type), ...] for docs
    missing category)."""
    collection = db.collection(settings.LEARNING_RESOURCES_COLLECTION)
    total = 0
    missing = []
    for doc in collection.stream():
        total += 1
        data = doc.to_dict() or {}
        if _category_is_missing(data):
            missing.append((doc.id, data.get("type")))
    return total, missing


def report(total: int, missing: list[tuple[str, str]]) -> None:
    print(f"Scanned {total} document(s) in '{settings.LEARNING_RESOURCES_COLLECTION}'.")
    print(f"Missing/None category: {len(missing)}")
    if not missing:
        return
    by_type: dict[str, int] = {}
    for _, resource_type in missing:
        by_type[resource_type or "<no type>"] = by_type.get(resource_type or "<no type>", 0) + 1
    print("Breakdown by type:")
    for resource_type, count in sorted(by_type.items(), key=lambda kv: -kv[1]):
        default = resolve_category(resource_type, None)
        print(f"  {resource_type:15s} -> will backfill to category={default!r}  ({count} doc(s))")


def apply_backfill(db, missing: list[tuple[str, str]]) -> int:
    """Writes ONLY the `category` field on each doc in `missing`, in
    batches. Returns the number of documents updated. Every doc here
    was already confirmed (by find_missing) to have category
    missing/None, so this can't overwrite a real existing value."""
    collection = db.collection(settings.LEARNING_RESOURCES_COLLECTION)
    updated = 0

    for start in range(0, len(missing), BATCH_SIZE):
        chunk = missing[start:start + BATCH_SIZE]
        batch = db.batch()
        for doc_id, resource_type in chunk:
            default_category = resolve_category(resource_type, None)
            batch.update(collection.document(doc_id), {"category": default_category})
        batch.commit()
        updated += len(chunk)
        print(f"  committed {updated}/{len(missing)}")

    return updated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true",
        help="Actually write the backfilled category field. Without this flag, "
             "the script only reports what it WOULD do.",
    )
    parser.add_argument(
        "--verify", action="store_true",
        help="Just count how many documents still have category missing/None "
             "and exit (no writes). Expected to print 0 after --apply.",
    )
    args = parser.parse_args()

    db = get_firestore_client()
    total, missing = find_missing(db)

    if args.verify:
        print(f"Scanned {total} document(s). Still missing category: {len(missing)}")
        sys.exit(0 if len(missing) == 0 else 1)

    report(total, missing)

    if not missing:
        print("\nNothing to do — every document already has a category.")
        return

    if not args.apply:
        print(f"\nDRY RUN — no writes made. Re-run with --apply to backfill "
              f"these {len(missing)} document(s).")
        return

    print(f"\nApplying backfill to {len(missing)} document(s)...")
    updated = apply_backfill(db, missing)
    print(f"Done. Updated {updated} document(s).")

    _, still_missing = find_missing(db)
    print(f"Verification: {len(still_missing)} document(s) still missing category "
          f"(expected 0).")


if __name__ == "__main__":
    main()
