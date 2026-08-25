import apiClient from "../api/axiosClient";

/**
 * getTopicPackage — calls the Learning Content Service
 * (backend/services/learning_content_service.py) for a given
 * skill/topic/focusBand. Returns AI-generated (cached) notes plus any
 * admin-verified curated resources.
 *
 * NOTE on scope: `topic` only drives the AI-generated notes (which may
 * be a lesson-composited "{topic} — {lessonTitle}" key — see
 * lessonService.compositeTopicKey()). Admin-managed resources are no
 * longer matched by topic at all — the backend matches them on
 * (skill, focusBand) instead (see services/resource_repository.py's
 * module docstring), so there's nothing extra to pass for resources to
 * show up correctly regardless of which lesson the learner is on.
 *
 * Uses a longer timeout on first load (same reasoning as
 * aiAssessmentService.js) — a cache MISS means a live Gemini/Groq call
 * happens before the response comes back; a cache HIT is fast.
 */
export async function getTopicPackage(skill, topic, focusBand) {
  const { data } = await apiClient.get(
    `/learning/topic/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}/${encodeURIComponent(focusBand)}`,
    { timeout: 60000 }
  );
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load learning content.");
  }
  return data.data; // { skill, topic, focusBand, notes, notesFromCache, resources, resourcesByCategory, ... }
}
