import apiClient from "../api/axiosClient";

/**
 * getTopicPackage — calls the Learning Content Service
 * (backend/services/learning_content_service.py) for a given
 * skill/topic/focusBand. Returns AI-generated (cached) notes plus any
 * admin-verified curated resources.
 *
 * NOTE on scope: the roadmap currently tracks one focusBand per SKILL,
 * not per finer-grained topic within it — so for now `topic` is passed
 * as the same string as `skill` (one learning session per roadmap
 * week). Splitting a skill into multiple sub-topics is a real future
 * step (would need the Roadmap Agent to output a topic list per skill),
 * not built yet — this is a known, deliberate simplification, not a bug.
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
