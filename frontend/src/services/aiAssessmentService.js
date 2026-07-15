import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * aiAssessmentService — calls the (real, deployed) Question Generation
 * Agent at POST /api/ai/generate-questions.
 *
 * Uses a longer timeout than the default apiClient (10s) because:
 *  - Render free-tier services cold-start (~15-50s) after idling
 *  - The Gemini call itself + one built-in retry can take several seconds
 * 60s covers both without the request tab timing out on a slow first hit,
 * the same class of problem Postman's Cloud Agent hit with its 30s cap.
 */
const GENERATION_TIMEOUT_MS = 60000;

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
