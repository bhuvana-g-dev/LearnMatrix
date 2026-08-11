import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * lessonService.js — backend/routes/lesson_routes.py, backend/services/lesson_service.py.
 *
 * Only the LIST call lives here. Lesson CONTENT is fetched through the
 * existing learningContentService.getTopicPackage(skill, compositeTopic,
 * focusBand) — see compositeTopicKey() below — reusing the same AI
 * notes cache + resource pipeline every other topic page already uses,
 * rather than a second content-fetching path.
 */

export async function getLessons(skill, topic) {
  const { data } = await apiClient.get(ENDPOINTS.LESSONS.LIST(skill, topic), {
    timeout: 60000, // a cache miss means a live Gemini call happens first
  });
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load lessons for this topic.");
  }
  return data.data.lessons; // [{ Order, Title, Summary }, ...]
}

/**
 * Must match backend models/lesson_model.py's Lesson.composite_topic_key()
 * EXACTLY (same "—" em dash separator) — this string is the cache key
 * both the AI notes cache and the YouTube search scope to.
 */
export function compositeTopicKey(topic, lessonTitle) {
  return `${topic} — ${lessonTitle}`;
}
