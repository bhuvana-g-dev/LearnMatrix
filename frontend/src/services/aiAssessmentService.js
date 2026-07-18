import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * aiAssessmentService — calls the (real, deployed) Question Generation
 * Agent at POST /api/ai/generate-questions.
 *
 * Uses a longer timeout than the default apiClient (10s) because:
 *  - Render free-tier services cold-start (~15-50s) after idling
 *  - The Gemini call itself + one built-in retry can take several seconds
 * 100s covers cold start + a retried Gemini call with its 2s backoff
 * delay, without the request timing out on a slow first hit — the same
 * class of problem Postman's Cloud Agent hit with its 30s cap.
 */
const GENERATION_TIMEOUT_MS = 100000;

/**
 * @param {object} params
 * @param {string} params.skill - e.g. the selected career role title
 * @param {string[]} params.topics - selected skills, treated as topics
 * @param {number} params.count
 * @param {string} [params.difficulty] - explicit override, skips the
 *   Difficulty Engine ("Easy"|"Medium"|"Hard")
 * @param {object} [params.signals] - raw performance signals for the
 *   Difficulty Engine to decide difficulty from instead (see
 *   backend/services/difficulty_engine.py). Provide this OR difficulty,
 *   not both — the backend requires exactly one.
 */
export async function generateAssessmentQuestions({
  skill,
  topics,
  count = 5,
  difficulty,
  signals,
  learning_objective = "",
}) {
  const payload = { skill, topics, count, learning_objective };
  if (difficulty) payload.difficulty = difficulty;
  else if (signals) payload.signals = signals;

  const { data } = await apiClient.post(
    ENDPOINTS.ASSESSMENT.GENERATE_QUESTIONS,
    payload,
    { timeout: GENERATION_TIMEOUT_MS }
  );

  // Backend response_helper shape: { success, message, data: {...} }
  if (!data.success) {
    throw new Error(data.error || data.message || "Question generation failed.");
  }
  // data.data shape (routes/ai_assessment_routes.py):
  //   { difficulty: "Medium", difficulty_reasoning: "..."|null, questions: [...] }
  return data.data;
}

/**
 * generateDiagnosticAssessment — the real diagnostic flow. One call
 * generates a fixed 2 Easy + 2 Medium + 2 Hard set PER selected skill
 * (backend/services/assessment_planner.py), all aggregated into one
 * question set with globally-unique TempIDs (each prefixed by skill).
 *
 * @param {string[]} skills - the student's selected skills (each gets
 *   its own 6-question Easy/Medium/Hard block)
 * @param {string} [role] - selected career role, used as generation
 *   context only (not a topic)
 * @returns {Promise<{skills: string[], totalQuestions: number, questions: object[]}>}
 */
export async function generateDiagnosticAssessment({ skills, role = "", learning_objective = "" }) {
  const { data } = await apiClient.post(
    ENDPOINTS.ASSESSMENT.GENERATE_DIAGNOSTIC_ASSESSMENT,
    { skills, role, learning_objective },
    { timeout: GENERATION_TIMEOUT_MS }
  );
  if (!data.success) {
    throw new Error(data.error || data.message || "Diagnostic assessment generation failed.");
  }
  return data.data;
}

/**
 * evaluateDiagnosticAssessment — Evaluation Agent. Send back the exact
 * `questions` array generateDiagnosticAssessment returned, plus the
 * student's answers keyed by TempID (skipped questions simply omitted).
 * Returns the skill-wise Strong/Intermediate/Weak/Not Attempted table.
 *
 * @param {object[]} questions
 * @param {Record<string, string>} answers - {TempID: "OptionA", ...}
 * @returns {Promise<{skills: object[], overall: {correct, total, scorePercent}}>}
 */
export async function evaluateDiagnosticAssessment(questions, answers) {
  // Fast, local, no cold-start/Gemini call involved — default timeout is fine.
  const { data } = await apiClient.post(
    ENDPOINTS.ASSESSMENT.EVALUATE_DIAGNOSTIC_ASSESSMENT,
    { questions, answers }
  );
  if (!data.success) {
    throw new Error(data.error || data.message || "Evaluation failed.");
  }
  return data.data;
}

/**
 * generateRoadmap — Roadmap Agent. Send the exact object
 * evaluateDiagnosticAssessment returned. Rule-based on the backend, not
 * an AI call, so this is fast and never fails due to Gemini/Groq being
 * down — default timeout is fine here too.
 *
 * Passing `uid` (and `role`) saves the roadmap to Firestore so it
 * survives a page reload instead of disappearing — omit it (e.g. for
 * quick local testing) and the roadmap is still generated, just not
 * persisted anywhere.
 *
 * @param {object} evaluation - {skills: [...], overall: {...}}
 * @param {string} [uid] - Firebase uid, enables persistence
 * @param {string} [role] - selected career role, stored alongside the roadmap
 * @returns {Promise<{entries: object[], alreadyStrong: string[], totalWeeks: number, includesProjectWeek: boolean, currentWeek?: number, completionPercent?: number}>}
 */
export async function generateRoadmap(evaluation, uid = null, role = "") {
  const { data } = await apiClient.post(ENDPOINTS.ASSESSMENT.GENERATE_ROADMAP, {
    evaluation,
    uid,
    role,
  });
  if (!data.success) {
    throw new Error(data.error || data.message || "Roadmap generation failed.");
  }
  return data.data;
}

/**
 * loadSavedRoadmap — fetches a previously generated & saved roadmap for
 * this user, if one exists. Returns null if the user has never taken
 * the diagnostic assessment yet (not an error — a normal, expected state).
 *
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
export async function loadSavedRoadmap(uid) {
  const { data } = await apiClient.get(`/roadmap/${uid}`);
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load roadmap.");
  }
  return data.data; // null if none saved yet
}
