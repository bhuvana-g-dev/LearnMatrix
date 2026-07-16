import { LEARNING_STATISTICS } from "../constants/learningStatistics";

export async function getLearningStatistics() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.LEARNING.STATISTICS);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(LEARNING_STATISTICS);
}
