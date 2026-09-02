import { db } from "../firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

/**
 * directProfileReads.js
 *
 * All Profile-dashboard reads, done straight against Firestore with the
 * Firebase client SDK instead of going through the Flask backend
 * (apiClient -> Render). None of these five documents/queries involve
 * any AI call or server-side computation — every one of them is the
 * backend just doing `db.collection(...).document(uid).get()` (or a
 * plain filtered query) and handing the dict back untouched. See:
 *   - backend/services/roadmap_repository.py   (roadmaps/{uid})
 *   - backend/services/assessment_repository.py (assessment_results/{uid})
 *   - backend/services/activity_repository.py   (learning_activity/{uid})
 *   - backend/services/certificate_repository.py (certificates/{uid})
 *   - backend/services/topic_quiz_repository.py  (topic_quiz_progress, Uid+NextReviewDate)
 *
 * Reading these the exact same way frontend/src/services/userProfileService.js
 * already reads users/{uid} means Profile loads instantly even while the
 * Render free-tier backend is asleep/cold-starting — no more 17-30s
 * cancelled requests just to show numbers that were sitting in Firestore
 * the whole time. Writes (generateRoadmap, submitting a quiz, recomputing
 * mastery, ...) still go through Flask — those genuinely need the
 * backend's logic and this file makes no attempt to duplicate them.
 *
 * Firestore security rules must allow a signed-in user to read their OWN
 * doc/rows in each of these collections (see firestore.rules) — the
 * Admin SDK the backend uses bypasses rules entirely, so this is new
 * surface that needs those rules added, not just a frontend change.
 */

export async function getRoadmapDirect(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "roadmaps", uid));
  return snap.exists() ? snap.data() : null;
}

export async function getAssessmentResultDirect(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "assessment_results", uid));
  return snap.exists() ? snap.data() : null;
}

export async function getActivityDirect(uid) {
  if (!uid) return [];
  const snap = await getDoc(doc(db, "learning_activity", uid));
  return snap.exists() ? snap.data().dates || [] : [];
}

export async function getCertificateDirect(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "certificates", uid));
  return snap.exists() ? snap.data() : null;
}

// Mirrors topic_quiz_repository.py's list_due_revisions /
// list_upcoming_revisions — same Uid-equality + NextReviewDate-range
// queries, same composite index they already require server-side (that
// index covers both the Admin SDK query and this client SDK query,
// since it's the same collection/fields — nothing extra to create if
// the backend versions already work).
export async function getRevisionsDirect(uid) {
  if (!uid) return { due: [], upcoming: [] };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toISO = (d) => d.toISOString().slice(0, 10);

  const start = new Date(today);
  start.setDate(start.getDate() + 1);
  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  const progressCol = collection(db, "topic_quiz_progress");

  const [dueSnap, upcomingSnap] = await Promise.all([
    getDocs(query(progressCol, where("Uid", "==", uid), where("NextReviewDate", "<=", toISO(today)))),
    getDocs(
      query(
        progressCol,
        where("Uid", "==", uid),
        where("NextReviewDate", ">=", toISO(start)),
        where("NextReviewDate", "<=", toISO(end))
      )
    ),
  ]);

  return {
    due: dueSnap.docs.map((d) => d.data()),
    upcoming: upcomingSnap.docs.map((d) => d.data()),
  };
}
