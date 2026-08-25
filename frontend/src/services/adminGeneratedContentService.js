import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * adminGeneratedContentService.js — backend/routes/generated_content_routes.py.
 *
 * Read + delete only for the shared/reused AI-generated notes cache —
 * there's no create/edit here on purpose, this content is only ever
 * produced by NotesGenerationAgent (see services/learning_content_service.py),
 * never hand-authored by an admin. Same envelope-unwrap convention as
 * adminResourceService.js.
 */

export async function fetchGeneratedContent(filters = {}) {
  const params = {};
  if (filters.skill) params.skill = filters.skill;
  if (filters.topic) params.topic = filters.topic;

  const { data } = await apiClient.get(ENDPOINTS.ADMIN.GENERATED_CONTENT.LIST, { params });
  if (!data.success) throw new Error(data.error || data.message || "Failed to load generated content.");
  return data.data;
}

export async function fetchGeneratedContentItem(id) {
  const { data } = await apiClient.get(ENDPOINTS.ADMIN.GENERATED_CONTENT.GET(id));
  if (!data.success) throw new Error(data.error || data.message || "Failed to load this content item.");
  return data.data;
}

export async function deleteGeneratedContent(id) {
  const { data } = await apiClient.delete(ENDPOINTS.ADMIN.GENERATED_CONTENT.DELETE(id));
  if (!data.success) throw new Error(data.error || data.message || "Failed to delete this content item.");
  return data.data;
}
