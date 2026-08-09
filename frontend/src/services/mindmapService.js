import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

const MINDMAP_TIMEOUT_MS = 60000; // LLM call — same reasoning as aiChatService/flashcardService

/**
 * generateMindMap — structures any given text into a proper
 * multi-branch mind map via the backend's MindMapAgent, instead of a
 * flat one-node dump.
 * @param {string} text - raw combined text (sources, chat transcript, or a typed topic)
 * @param {string} [label] - what the text represents, e.g. "the student's uploaded sources"
 * @returns {Promise<{title: string, branches: {label: string, detail: string}[]}>}
 */
export async function generateMindMap(text, label) {
  const { data } = await apiClient.post(
    ENDPOINTS.MINDMAP.GENERATE,
    { text, label },
    { timeout: MINDMAP_TIMEOUT_MS }
  );
  if (!data.success) throw new Error(data.error || data.message || "Couldn't generate the mind map.");
  return data.data;
}
