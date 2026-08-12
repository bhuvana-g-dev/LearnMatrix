import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * Admin Learner Intelligence service (backend: routes/admin_learner_routes.py).
 * Every field traces back to a real topic_quiz_progress / topic_quiz_attempts
 * Firestore doc via services/learner_intelligence_service.py — no
 * client-side aggregation, no fake numbers.
 */

export async function fetchLearners(filters = {}) {
  const params = {};
  if (filters.email) params.email = filters.email;
  if (filters.skill) params.skill = filters.skill;
  if (filters.topic) params.topic = filters.topic;
  if (filters.learnerType) params.learnerType = filters.learnerType;

  const { data } = await apiClient.get(ENDPOINTS.ADMIN.LEARNERS.LIST, { params });
  return data.data;
}

export async function fetchLearnerProfile(email) {
  const { data } = await apiClient.get(ENDPOINTS.ADMIN.LEARNERS.PROFILE, {
    params: { email },
  });
  return data.data;
}
