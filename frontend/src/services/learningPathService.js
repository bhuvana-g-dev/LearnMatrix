import apiClient from "../api/axiosClient";
import { auth as firebaseAuth } from "../firebase";

/**
 * learningPathService.js
 *
 * getLearningPath — calls backend/routes/learning_routes.py's
 * GET /learning/path/<skill>/<topic>, which returns one Topic Package
 * per band in the learner's initial-assessment-driven band sequence
 * (see backend/services/learning_path.py).
 *
 * AUTH NOTE: apiClient's shared interceptor (api/axiosClient.js) only
 * attaches a token from localStorage["lm_auth_token"], which today is
 * only ever set by services/adminAuthService.js's admin login flow —
 * there's no equivalent "store the learner's ID token" step anywhere
 * yet for a regular signed-in student. Rather than repurpose that
 * admin-oriented storage key for students (risking the two flows
 * colliding for a user who is both), this fetches a FRESH ID token
 * directly from the already-signed-in Firebase user
 * (services/adminAuthService.js's getIdToken() call is the mirror of
 * this) and attaches it explicitly on just this request. Scoped to
 * this one endpoint only, same as the backend's require_learner
 * decorator being scoped to this one route for now — see
 * backend/utils/learner_auth.py's module docstring.
 */
export async function getLearningPath(skill, topic) {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error("You need to be signed in to load your learning path.");
  }
  const idToken = await currentUser.getIdToken();

  const { data } = await apiClient.get(
    `/learning/path/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}`,
    {
      timeout: 60000, // same reasoning as learningContentService.js — a cold cache means a live Gemini call per band
      headers: { Authorization: `Bearer ${idToken}` },
    }
  );
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load your learning path.");
  }
  return data.data; // { skill, topic, currentLevel, bandSequence, sessions: [ {..topic package..}, ... ] }
}
