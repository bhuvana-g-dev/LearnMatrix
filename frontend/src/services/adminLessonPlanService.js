import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * adminLessonPlanService.js — backend/routes/admin_lesson_routes.py.
 *
 * Read + delete only for the cached lesson-plan (ordered Title list)
 * per (skill, topic) — separate cache from adminGeneratedContentService.js's
 * notes. Same envelope-unwrap convention as that service.
 */

export async function fetchLessonPlans(filters = {}) {
  const params = {};
  if (filters.skill) params.skill = filters.skill;
  if (filters.topic) params.topic = filters.topic;

  const { data } = await apiClient.get(ENDPOINTS.ADMIN.LESSON_PLANS.LIST, { params });
  if (!data.success) throw new Error(data.error || data.message || "Failed to load lesson plans.");
  return data.data;
}

export async function deleteLessonPlan(skill, topic) {
  const { data } = await apiClient.delete(ENDPOINTS.ADMIN.LESSON_PLANS.DELETE(skill, topic));
  if (!data.success) throw new Error(data.error || data.message || "Failed to delete this lesson plan.");
  return data.data;
}
