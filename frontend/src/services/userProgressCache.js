import { loadSavedRoadmap, loadSavedAssessmentResult } from "./aiAssessmentService";

/**
 * userProgressCache.js
 *
 * Session-lifetime, per-uid, in-memory cache in front of
 * loadSavedRoadmap() and loadSavedAssessmentResult() — the two
 * Firestore-backed reads that were each being triggered from ~8
 * different files independently.
 *
 * The single biggest case this fixes: hooks/useProfile.js's one
 * Promise.all fires getLearningProgress() + getCompletedCourses() +
 * getLearningStatistics() + getAIInsights() simultaneously — which
 * between them called loadSavedRoadmap 3 TIMES and
 * loadSavedAssessmentResult 3 TIMES, all in the same page load, for
 * the exact same uid, before any of them had resolved. That part of
 * the fix (in-flight de-duplication — a second caller attaches to the
 * SAME pending request instead of firing a new one) is a pure win: it
 * cannot serve stale data, because the calls are genuinely
 * simultaneous.
 *
 * On top of that, a resolved result is kept for CACHE_TTL_MS so that
 * navigating between screens (Profile Dashboard -> Career Status ->
 * My Roadmap -> Skill Progress etc. — see CHANGES.md for the full
 * before-list) within that window reuses the same data instead of
 * re-reading Firestore. This part DOES trade a little freshness for
 * fewer reads: the roadmap document changes server-side whenever a
 * topic quiz is completed (services/focus_band.py recomputes mastery
 * -> services/roadmap_repository.py updates the saved roadmap), and
 * this cache has no way to know that happened. Kept deliberately
 * short (30s) so that trade-off is small, and the known mutation
 * points that happen through THIS frontend (finishing the diagnostic
 * assessment, generating a roadmap, quitting a role) explicitly call
 * invalidate*() below rather than relying on the TTL alone — see
 * screens/AssessmentScreen.jsx and screens/RoadmapScreen.jsx.
 *
 * A failed fetch is never cached — the next caller always gets a
 * fresh attempt, so a transient Render cold-start timeout can't get
 * "stuck" as a cached failure.
 */
const CACHE_TTL_MS = 30_000;

function makeCache(fetcher) {
  const entries = new Map(); // uid -> { promise, resolvedAt: number|null }

  function get(uid) {
    if (!uid) return Promise.resolve(null);

    const existing = entries.get(uid);
    if (existing && (existing.resolvedAt === null || Date.now() - existing.resolvedAt < CACHE_TTL_MS)) {
      return existing.promise; // in-flight, or resolved within the TTL window
    }

    const promise = fetcher(uid)
      .then((result) => {
        const current = entries.get(uid);
        if (current && current.promise === promise) current.resolvedAt = Date.now();
        return result;
      })
      .catch((err) => {
        if (entries.get(uid)?.promise === promise) entries.delete(uid);
        throw err;
      });

    entries.set(uid, { promise, resolvedAt: null });
    return promise;
  }

  function invalidate(uid) {
    if (uid) entries.delete(uid);
    else entries.clear();
  }

  return { get, invalidate };
}

const roadmapCache = makeCache(loadSavedRoadmap);
const assessmentCache = makeCache(loadSavedAssessmentResult);

/** Drop-in replacement for loadSavedRoadmap(uid) — same return shape
 * (the roadmap object, or null if none saved yet), just de-duplicated/cached. */
export function getCachedRoadmap(uid) {
  return roadmapCache.get(uid);
}

/** Drop-in replacement for loadSavedAssessmentResult(uid) — same
 * return shape, de-duplicated/cached. */
export function getCachedAssessmentResult(uid) {
  return assessmentCache.get(uid);
}

/** Call after anything that changes the saved roadmap server-side for
 * this uid (right now: generateRoadmap() succeeding, and quitRole()) —
 * see screens/AssessmentScreen.jsx and screens/RoadmapScreen.jsx. */
export function invalidateRoadmap(uid) {
  roadmapCache.invalidate(uid);
}

/** Call after anything that changes the saved assessment result
 * server-side for this uid (right now: evaluateDiagnosticAssessment()
 * succeeding, and quitRole()). */
export function invalidateAssessmentResult(uid) {
  assessmentCache.invalidate(uid);
}

/** Both together — quitRole() clears both in one go; a fresh
 * assessment+roadmap generation also touches both. */
export function invalidateUserProgress(uid) {
  invalidateRoadmap(uid);
  invalidateAssessmentResult(uid);
}
