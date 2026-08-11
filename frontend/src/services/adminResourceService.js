import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * Admin Resource Bank service (backend: routes/learning_routes.py).
 * Same convention as adminQuestionService.js — screens/hooks never call
 * apiClient or ENDPOINTS directly, everything about "how" a resource is
 * fetched/saved lives here.
 */

export async function fetchResources(filters = {}) {
  const params = {};
  if (filters.skill) params.skill = filters.skill;
  if (filters.topic) params.topic = filters.topic;
  if (filters.type) params.type = filters.type;
  if (filters.difficulty) params.difficulty = filters.difficulty;
  if (filters.status) params.status = filters.status;

  const { data } = await apiClient.get(ENDPOINTS.ADMIN.RESOURCES.LIST, { params });
  return data.data; // unwrap the { success, message, data } envelope
}

export async function createResource(payload) {
  const { data } = await apiClient.post(ENDPOINTS.ADMIN.RESOURCES.CREATE, payload);
  return data.data;
}

export async function updateResource(resourceId, payload) {
  const { data } = await apiClient.patch(ENDPOINTS.ADMIN.RESOURCES.UPDATE(resourceId), payload);
  return data.data;
}

export async function deleteResource(resourceId) {
  const { data } = await apiClient.delete(ENDPOINTS.ADMIN.RESOURCES.DELETE(resourceId));
  return data.data;
}

export async function setResourcePinned(resourceId, pinned) {
  const { data } = await apiClient.patch(ENDPOINTS.ADMIN.RESOURCES.SET_PINNED(resourceId), { pinned });
  return data.data;
}

export async function setResourceEnabled(resourceId, enabled) {
  const { data } = await apiClient.patch(ENDPOINTS.ADMIN.RESOURCES.SET_ENABLED(resourceId), { enabled });
  return data.data;
}

/** AI-suggests documentation/article/github/pdf/cheatsheet/practice
 * resources (never video — see agents/resource_suggestion_agent.py),
 * saved as status="pending" for review below. */
export async function suggestResourcesViaAI(skill, topic, count = 5) {
  const { data } = await apiClient.post(
    ENDPOINTS.ADMIN.RESOURCES.SUGGEST_AI,
    { skill, topic, count },
    { timeout: 60000 } // AI generation call, same longer timeout convention as aiAssessmentService.js
  );
  if (!data.success) throw new Error(data.error || data.message || "AI suggestion failed.");
  return data.data;
}

/** Real YouTube Data API v3 search, saved as status="pending" for
 * review below — every result here is a real, existing video. */
export async function suggestResourcesViaYouTube(skill, topic, count = 6) {
  const { data } = await apiClient.post(
    ENDPOINTS.ADMIN.RESOURCES.SUGGEST_YOUTUBE,
    { skill, topic, count },
    { timeout: 20000 }
  );
  if (!data.success) throw new Error(data.error || data.message || "YouTube search failed.");
  return data.data;
}

/** One-click "fill this topic in" — generates AND immediately verifies
 * both non-video and video resources, skipping the pending queue.
 * verifiedBy is the logged-in admin's identity (see hooks/useAdminAuth.js),
 * recorded on every resource created for the audit trail. */
export async function bulkGenerateAndVerify(skill, topic, verifiedBy, { articleCount = 5, videoCount = 4 } = {}) {
  const { data } = await apiClient.post(
    ENDPOINTS.ADMIN.RESOURCES.BULK_GENERATE_AND_VERIFY,
    { skill, topic, verifiedBy, articleCount, videoCount },
    { timeout: 60000 }
  );
  if (!data.success) throw new Error(data.error || data.message || "Bulk generation failed.");
  return data.data; // { skill, topic, articles: [...], videos: [...], errors: [...] }
}

export async function fetchPendingResources(filters = {}) {
  const params = {};
  if (filters.skill) params.skill = filters.skill;
  if (filters.topic) params.topic = filters.topic;

  const { data } = await apiClient.get(ENDPOINTS.ADMIN.RESOURCES.PENDING, { params });
  return data.data;
}

export async function verifyResource(resourceId, verifiedBy) {
  const { data } = await apiClient.patch(ENDPOINTS.ADMIN.RESOURCES.VERIFY(resourceId), { verifiedBy });
  return data.data;
}

export async function unverifyResource(resourceId) {
  const { data } = await apiClient.patch(ENDPOINTS.ADMIN.RESOURCES.UNVERIFY(resourceId));
  return data.data;
}

export async function rejectResource(resourceId) {
  const { data } = await apiClient.patch(ENDPOINTS.ADMIN.RESOURCES.REJECT(resourceId));
  return data.data;
}
