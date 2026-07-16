import { AI_INSIGHTS } from "../constants/aiInsights";

export async function getAIInsights() {
  // ---- FUTURE (Flask + Gemini/Scikit-Learn) ----
  // const { data } = await apiClient.get(ENDPOINTS.RECOMMENDATION.INSIGHTS);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(AI_INSIGHTS);
}
