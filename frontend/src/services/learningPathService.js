import apiClient from "../api/axiosClient";

/**
 * learningPathService.js
 *
 * getLearningPath — calls backend/routes/learning_routes.py's
 * GET /learning/path/<skill>/<topic>, which returns one Topic Package
 * per band in the learner's initial-assessment-driven band sequence
 * (see backend/services/learning_path.py).
 *
 * No manual token handling needed here — api/axiosClient.js's shared
 * interceptor already attaches a fresh Firebase ID token
 * (auth.currentUser.getIdToken()) to every request. An earlier version
 * of this file fetched and attached that token manually because the
 * shared interceptor didn't do this yet; now that it does, doing it
 * again here would just be dead, duplicate logic.
 */
export async function getLearningPath(skill, topic) {
  const { data } = await apiClient.get(
    `/learning/path/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}`,
    { timeout: 60000 } // same reasoning as learningContentService.js — a cold cache means a live Gemini call per band
  );
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load your learning path.");
  }
  return data.data; // { skill, topic, currentLevel, bandSequence, sessions: [ {..topic package..}, ... ] }
}
