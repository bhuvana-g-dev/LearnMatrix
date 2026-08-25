import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * skillTopicService.js — backend/routes/skill_topic_routes.py.
 *
 * Used by the admin Resource Management screen for the Skill -> Topic
 * step (skill_topics collection, independent of role — works for any
 * skill that has a seeded topic list, not just role-seeded ones).
 * Returns [] (not an error) when a skill has no seeded topics yet, so
 * callers can fall back to a free-text topic field.
 */
export async function getTopicsForSkill(skill) {
  if (!skill) return [];
  const { data } = await apiClient.get(ENDPOINTS.SKILLS.TOPICS(skill));
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load topics for this skill.");
  }
  return data.data.topics || []; // [{ TopicID, Skill, Title, Order, ... }]
}
