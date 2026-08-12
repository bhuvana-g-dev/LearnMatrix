"""
scripts/grant_admin.py

One-time bootstrap: grants (or revokes) the `admin: true` Firebase Auth
custom claim that utils/admin_auth.py checks on every /api/admin/*
request. Run this once per person who needs Admin Panel access — there
is deliberately no UI for this (the Admin Panel shouldn't be able to
grant itself admins).

Usage:
    python scripts/grant_admin.py alice@example.com
    python scripts/grant_admin.py alice@example.com --revoke

Requires the same Firebase service account the rest of the backend
already uses (see firebase/firebase_config.py / config/settings.py).
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from firebase_admin import auth as firebase_auth

from firebase.firebase_config import get_firestore_client  # triggers firebase_admin.initialize_app()


def main():
    parser = argparse.ArgumentParser(description="Grant or revoke admin access for a LearnMatrix user.")
    parser.add_argument("email", help="Firebase Auth email of the user.")
    parser.add_argument("--revoke", action="store_true", help="Remove admin access instead of granting it.")
    args = parser.parse_args()

    get_firestore_client()  # ensures Firebase Admin SDK is initialized before we touch auth

    try:
        user = firebase_auth.get_user_by_email(args.email)
    except Exception as exc:  # noqa: BLE001
        print(f"No Firebase Auth user found for '{args.email}': {exc}")
        sys.exit(1)

    claims = dict(user.custom_claims or {})
    if args.revoke:
        claims.pop("admin", None)
        firebase_auth.set_custom_user_claims(user.uid, claims)
        print(f"Revoked admin access for {args.email} (uid={user.uid}).")
    else:
        claims["admin"] = True
        firebase_auth.set_custom_user_claims(user.uid, claims)
        print(f"Granted admin access to {args.email} (uid={user.uid}).")
        print("They must sign out and back in (or force-refresh their ID token) for this to take effect.")


if __name__ == "__main__":
    main()
