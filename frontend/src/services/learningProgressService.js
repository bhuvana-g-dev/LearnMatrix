import { LEARNING_PROGRESS } from "../constants/learningProgress";

export async function getLearningProgress() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.LEARNING.PROGRESS);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(LEARNING_PROGRESS);
}
