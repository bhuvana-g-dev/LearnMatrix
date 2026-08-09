import { COMPLETED_COURSES } from "../constants/completedCourses";

export async function getCompletedCourses() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.LEARNING.COMPLETED);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(COMPLETED_COURSES);
}
