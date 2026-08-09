import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * syllabusService — Skill Syllabus Tree + Compression Engine
 * (backend/services/skill_topic_service.py,
 *  backend/services/syllabus_compression_service.py).
 *
 * Two calls:
 *  - getRoleSyllabus: the raw, uncompressed skill -> topic tree for a
 *    role. Rarely needed directly by a screen — mostly useful for an
 *    admin/preview view of "what does this role's full curriculum
 *    look like regardless of anyone's score".
 *  - getCompressedRoleSyllabus: the same tree, but with every topic
 *    tagged Verified / Current / Locked based on a diagnostic
 *    evaluation. This is what RoadmapDisplay actually renders per
 *    skill once expanded.
 */

/**
 * @param {string} roleId - e.g. "frontend" (constants/roles.js ROLES[].id)
 * @returns {Promise<{roleId: string, skills: Array<{skill: string, topicCount: number, topics: object[]}>}>}
 */
export async function getRoleSyllabus(roleId) {
  const { data } = await apiClient.get(ENDPOINTS.SYLLABUS.GET_ROLE_SYLLABUS(roleId));
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load the role syllabus.");
  }
  return data.data;
}

/**
 * @param {string} roleId - e.g. "frontend"
 * @param {object} evaluation - the exact object evaluateDiagnosticAssessment
 *   returned: {skills: [...], overall: {...}}
 * @returns {Promise<{roleId: string, skills: Array<{
 *   skill: string, scorePercent: number|null, level: string,
 *   verifiedCount: number, totalTopics: number,
 *   topics: Array<{topicId: string, title: string, order: number,
 *     status: "Verified"|"Current"|"Locked", note: string}>
 * }>}>}
 */
export async function getCompressedRoleSyllabus(roleId, evaluation) {
  const { data } = await apiClient.post(
    ENDPOINTS.SYLLABUS.GET_COMPRESSED_SYLLABUS(roleId),
    { evaluation }
  );
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load the compressed syllabus.");
  }
  return data.data;
}
