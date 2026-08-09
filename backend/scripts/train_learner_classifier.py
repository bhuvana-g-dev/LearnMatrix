"""
scripts/train_learner_classifier.py

Retrains services/learner_classifier.py's model on real topic_quiz_attempts
data. Run manually (or on a cron) as attempts accumulate:

    python scripts/train_learner_classifier.py

Falls back to bootstrap-only if there isn't enough real data yet — see
learner_classifier.MIN_REAL_SAMPLES_FOR_RETRAIN. Safe to re-run any time;
each run overwrites the saved model with a fresh one trained on the
latest data.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from firebase.firebase_config import get_firestore_client
from services import topic_quiz_repository as repo
from services import learner_classifier as lc


def main():
    db = get_firestore_client()
    attempts = repo.list_all_attempts(db)
    print(f"Fetched {len(attempts)} real attempt(s) from Firestore.")

    if len(attempts) < lc.MIN_REAL_SAMPLES_FOR_RETRAIN:
        print(
            f"Fewer than {lc.MIN_REAL_SAMPLES_FOR_RETRAIN} real samples — "
            f"training on bootstrap data only (real data will be blended "
            f"in automatically once there's enough)."
        )

    model = lc.train_and_save(real_attempts=attempts)
    print(f"Model trained and saved to {lc._MODEL_PATH}")
    print(f"Classes: {list(model.classes_)}")


if __name__ == "__main__":
    main()
