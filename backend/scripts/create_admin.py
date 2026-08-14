"""
scripts/create_admin.py

One command to get someone into the Admin Panel — creates their Firebase
Auth account if it doesn't exist yet (or reuses it if it does, e.g. they
already have a student login), then grants the `admin: true` custom
claim utils/admin_auth.py checks on every /api/admin/* request.

This is the fast path for onboarding a real teammate. scripts/grant_admin.py
still exists separately for granting/revoking admin on an account that
already exists (e.g. created via the Firebase Console) without touching
its password.

Usage:
    python scripts/create_admin.py alice@example.com herChosenPassword
    python scripts/create_admin.py bob@example.com hisChosenPassword

Password must be at least 6 characters (Firebase Auth's own minimum) —
it can be anything memorable, simple passwords are fine. If the email
already has a Firebase account, the password argument is ignored and
that existing account is just granted admin access.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from firebase_admin import auth as firebase_auth

from firebase.firebase_config import get_firestore_client  # triggers firebase_admin.initialize_app()


def main():
    parser = argparse.ArgumentParser(
        description="Create (or reuse) a Firebase account and grant it admin access, in one step."
    )
    parser.add_argument("email", help="Email for the admin account.")
    parser.add_argument("password", help="Password to set if this is a NEW account (min 6 characters).")
    args = parser.parse_args()

    get_firestore_client()  # ensures Firebase Admin SDK is initialized before we touch auth

    try:
        user = firebase_auth.get_user_by_email(args.email)
        print(f"Found an existing account for {args.email} — reusing it (password left unchanged).")
    except firebase_auth.UserNotFoundError:
        try:
            user = firebase_auth.create_user(email=args.email, password=args.password)
            print(f"Created a new account for {args.email}.")
        except Exception as exc:  # noqa: BLE001 — e.g. password too short, invalid email
            print(f"Couldn't create the account: {exc}")
            sys.exit(1)

    claims = dict(user.custom_claims or {})
    claims["admin"] = True
    firebase_auth.set_custom_user_claims(user.uid, claims)

    print(f"{args.email} now has admin access (uid={user.uid}).")
    print("They can log in on the Admin Panel with this email + their password now.")
    print("If they were already signed in elsewhere in the browser, they should sign out and back in first.")


if __name__ == "__main__":
    main()
