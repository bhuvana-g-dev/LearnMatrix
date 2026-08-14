/**
 * utils/streak.js
 *
 * Computes a real, unbounded "current streak" (consecutive days active,
 * counting back from today) from the raw activity dates array returned
 * by GET /api/activity/<uid> (services/activityService.js -> real
 * Firestore data, see backend/services/activity_repository.py).
 *
 * A day still counts as "in progress" if today itself has no ping yet
 * but yesterday does — so the streak doesn't drop to 0 the moment the
 * clock rolls over before the learner has opened the app today.
 */
export function computeCurrentStreak(dates) {
  if (!dates || dates.length === 0) return 0;

  const dateSet = new Set(dates);
  const toIso = (d) => d.toISOString().slice(0, 10);

  const today = new Date();
  let cursor = new Date(today);

  if (!dateSet.has(toIso(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dateSet.has(toIso(cursor))) return 0; // inactive today AND yesterday -> streak is over
  }

  let count = 0;
  while (dateSet.has(toIso(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
