import apiClient from "../api/axiosClient";

/**
 * getTopicPackage — calls the Learning Content Service
 * (backend/services/learning_content_service.py) for a given
 * skill/topic/focusBand. Returns AI-generated (cached) notes plus any
 * admin-verified curated resources.
 *
 * NOTE on scope: `skill` and `topic` are independent by now — topics
 * come from the compressed syllabus / per-topic quiz progress
 * (utils/buildCourseNavigator.js), and lessons pass a composite
 * "{topic} — {lessonTitle}" key here as `topic` (see
 * lessonService.compositeTopicKey()). Earlier revisions of this app
 * only tracked one focusBand per skill and passed topic === skill;
 * that's no longer the case anywhere this function is called from.
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
  return data.data; // { skill, topic, focusBand, notes, notesFromCache, resources }
}
