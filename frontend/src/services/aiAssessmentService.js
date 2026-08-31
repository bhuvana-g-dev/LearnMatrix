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
 * generates a fixed 5 Easy + 5 Medium + 5 Hard set PER selected skill
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
 * Passing `uid`/`role`/`skills` also saves the FULL result (questions,
 * answers, evaluation) to Firestore — this is what makes a page refresh
 * show the same completed result instead of silently regenerating a
 * brand-new assessment. Omit them to evaluate without persisting.
 *
 * @param {object[]} questions
 * @param {Record<string, string>} answers - {TempID: "OptionA" | <typed answer text>, ...}
 * @param {string} [uid]
 * @param {string} [role]
 * @param {string[]} [skills]
 * @returns {Promise<{skills: object[], overall: {correct, total, scorePercent}, questionResults: Record<string, boolean>}>}
 */
export async function evaluateDiagnosticAssessment(questions, answers, uid = null, role = "", skills = []) {
  // NOT "fast, local, no Gemini call involved" — evaluation grades every
  // FillBlank/CodeCompletion answer via answer_equivalence_service.py,
  // which calls Gemini for anything that isn't an exact normalized-string
  // match. Worse, submission happens minutes after generation, with no
  // requests hitting the backend in between while the student is
  // answering — long enough for Render's free tier to spin the backend
  // down, so this request often has to eat a cold start (15-50s) AND
  // the grading calls. EVALUATION_TIMEOUT_MS gives it room for both;
  // the previous 10s default timeout is exactly why submission was
  // intermittently failing after a long assessment.
  const EVALUATION_TIMEOUT_MS = 90000;

  const { data } = await apiClient.post(
    ENDPOINTS.ASSESSMENT.EVALUATE_DIAGNOSTIC_ASSESSMENT,
    { questions, answers, uid, role, skills },
    { timeout: EVALUATION_TIMEOUT_MS }
  );
  if (!data.success) {
    throw new Error(data.error || data.message || "Evaluation failed.");
  }
  return data.data;
}

/**
 * loadSavedAssessmentResult — checks whether this user already has a
 * completed assessment saved. Call this BEFORE generating a new one —
 * if it returns non-null, show that saved result instead of calling
 * generateDiagnosticAssessment at all.
 *
 * @param {string} uid
 * @returns {Promise<{role, skills, questions, answers, evaluation}|null>}
 */
export async function loadSavedAssessmentResult(uid) {
  const { data } = await apiClient.get(`/assessment-result/${uid}`);
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load your assessment result.");
  }
  return data.data; // null if none saved yet
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
 * Passing `roleId` (e.g. "frontend" — see constants/roles.js) makes the
 * roadmap role-driven: every skill in that role's syllabus is included,
 * not just the ones assessed — unclaimed skills come back as their own
 * "not_assessed" entries instead of disappearing. Omit it and the
 * roadmap falls back to assessed-skills-only, same as before. Either
 * way, the response now also includes `compressedSyllabus` — the
 * topic-level Verified/Current/Locked tree per skill, ready to hand
 * straight to <RoadmapDisplay compressedSyllabus={...} /> — no second
 * call needed.
 *
 * @param {object} evaluation - {skills: [...], overall: {...}}
 * @param {string} [uid] - Firebase uid, enables persistence
 * @param {string} [role] - selected career role TITLE, stored alongside the roadmap
 * @param {string} [roleId] - selected career role ID, drives the full curriculum
 * @returns {Promise<{entries: object[], totalWeeks: number, includesProjectWeek: boolean, notAssessedCount: number, compressedSyllabus: object|null, currentWeek?: number, completionPercent?: number}>}
 */
export async function generateRoadmap(evaluation, uid = null, role = "", roleId = "") {
  const { data } = await apiClient.post(ENDPOINTS.ASSESSMENT.GENERATE_ROADMAP, {
    evaluation,
    uid,
    role,
    roleId,
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

/**
 * recomputeRoadmapMastery — POSTs to /roadmap/<uid>/recompute, which
 * re-judges every skill on the saved roadmap under the CURRENT mastery
 * rules (services.roadmap_service.recompute_all_mastery). Needed
 * because the automatic recompute only fires as a side-effect of a NEW
 * topic quiz submission — progress completed before a mastery-logic
 * change ships otherwise stays stuck showing the old verdict forever.
 * See services/userProgressCache.js, which calls this once per Profile
 * dashboard load (bounded by the same cache TTL) and invalidates the
 * roadmap cache if anything actually changed.
 *
 * @param {string} uid
 * @returns {Promise<object|null>} the recomputed roadmap, or null if
 *   the user has no saved roadmap yet.
 */
export async function recomputeRoadmapMastery(uid) {
  const { data } = await apiClient.post(`/roadmap/${uid}/recompute`);
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to recompute roadmap.");
  }
  return data.data;
}

/**
 * quitRole — "Quit Role" (Learning Hub). Deletes the saved assessment
 * AND saved roadmap for this uid so Role Selection unlocks again. This
 * is the ONLY way back to Role Selection once a role has been chosen —
 * there's no other "change course" shortcut left in the app.
 *
 * @param {string} uid
 */
export async function quitRole(uid) {
  const { data } = await apiClient.delete(ENDPOINTS.ASSESSMENT.QUIT_ROLE(uid));
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to quit role.");
  }
}
