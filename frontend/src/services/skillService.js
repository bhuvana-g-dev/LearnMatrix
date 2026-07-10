import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";
import { ROLE_SKILLS, DEFAULT_SKILL_CATEGORIES } from "../constants/skills";

/**
 * Skill service. Screens call this instead of importing ROLE_SKILLS
 * directly, so the data source can move to Flask (and eventually be
 * personalized via Scikit-Learn) without touching SkillSelectionScreen.
 */
export async function getSkillsByRole(roleId) {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.SKILLS.BY_ROLE(roleId));
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(ROLE_SKILLS[roleId] || DEFAULT_SKILL_CATEGORIES);
}

export async function submitSelectedSkills(payload) {
  // payload shape: { role: string, skills: string[] }
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.post(ENDPOINTS.SKILLS.SUBMIT, payload);
  // return data;

  // ---- CURRENT (dummy/local) ----
  console.log("[skillService] submitSelectedSkills (mock):", payload);
  return Promise.resolve({ success: true, receivedAt: new Date().toISOString() });
}
