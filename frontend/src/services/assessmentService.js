import { UPCOMING_ASSESSMENTS } from "../constants/upcomingAssessments";

export async function getUpcomingAssessments() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.ASSESSMENT.UPCOMING);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(UPCOMING_ASSESSMENTS);
}
