import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * aiChatService — calls the Chat Agent at POST /api/ai/chat, plus
 * listing/loading/deleting past conversations (SESSIONS) and managing
 * sources at /api/ai/chat/:uid/sources*.
 *
 * Chat is session-based (like ChatGPT's sidebar) rather than one
 * continuous thread — see backend/services/chat_repository.py.
 */
const CHAT_TIMEOUT_MS = 60000; // cold starts + a retried Gemini/Groq call can take a while

/**
 * @param {string} uid - Firebase uid
 * @param {string} message - the student's new message
 * @param {string|null} [sessionId] - omit/null to start a NEW conversation
 * @param {object} [context] - optional {skill, topic} the student is studying
 * @returns {Promise<{sessionId: string, reply: string, suggestions: string[], citedSources: string[], history: object[]}>}
 */
export async function sendChatMessage(uid, message, sessionId, context) {
  const payload = { uid, message };
  if (sessionId) payload.sessionId = sessionId;
  if (context) payload.context = context;

  const { data } = await apiClient.post(ENDPOINTS.AI_CHAT.SEND_MESSAGE, payload, {
    timeout: CHAT_TIMEOUT_MS,
  });
  if (!data.success) {
    throw new Error(data.error || data.message || "The AI Study Assistant couldn't reply.");
  }
  return data.data;
}

/**
 * listChatSessions — this user's past conversations (title + message
 * count), most recently active first. Used to render the chat history
 * dropdown.
 * @returns {Promise<{id: string, title: string, messageCount: number}[]>}
 */
export async function listChatSessions(uid) {
  const { data } = await apiClient.get(ENDPOINTS.AI_CHAT.SESSIONS(uid));
  if (!data.success) throw new Error(data.error || data.message || "Failed to load chat history.");
  return data.data?.sessions || [];
}

/**
 * loadChatSession — full messages for one past conversation.
 * @returns {Promise<object[]>}
 */
export async function loadChatSession(uid, sessionId) {
  const { data } = await apiClient.get(ENDPOINTS.AI_CHAT.SESSION(uid, sessionId));
  if (!data.success) throw new Error(data.error || data.message || "Failed to load that conversation.");
  return data.data?.history || [];
}

/** deleteChatSession — removes one past conversation entirely. */
export async function deleteChatSession(uid, sessionId) {
  const { data } = await apiClient.delete(ENDPOINTS.AI_CHAT.SESSION(uid, sessionId));
  if (!data.success) throw new Error(data.error || data.message || "Failed to delete that conversation.");
}

/**
 * uploadChatSource — sends a PDF/txt/md file to be chunked + embedded
 * as a new grounded-chat source.
 * @returns {Promise<{sourceId: string, title: string, chunkCount: number}>}
 */
export async function uploadChatSource(uid, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post(ENDPOINTS.AI_CHAT.SOURCES(uid), formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
  if (!data.success) throw new Error(data.error || data.message || "Couldn't add that source.");
  return data.data;
}

/**
 * addNotesAsSource — links an already-generated Learning Hub notes
 * entry (skill/topic/focusBand) as a chat source.
 * @returns {Promise<{sourceId: string, title: string, chunkCount: number}>}
 */
export async function addNotesAsSource(uid, { skill, topic, focusBand }) {
  const { data } = await apiClient.post(ENDPOINTS.AI_CHAT.SOURCE_FROM_NOTES(uid), { skill, topic, focusBand });
  if (!data.success) throw new Error(data.error || data.message || "Couldn't add those notes as a source.");
  return data.data;
}

/**
 * addYoutubeSource — sends a YouTube video URL to be transcribed,
 * chunked, and embedded as a new grounded-chat source (NotebookLM-
 * style "add a link" alongside file upload).
 * @returns {Promise<{sourceId: string, title: string, chunkCount: number}>}
 */
export async function addYoutubeSource(uid, url) {
  const { data } = await apiClient.post(ENDPOINTS.AI_CHAT.SOURCE_FROM_YOUTUBE(uid), { url }, {
    timeout: 60000, // transcript fetch + embedding can take a bit
  });
  if (!data.success) throw new Error(data.error || data.message || "Couldn't add that video.");
  return data.data;
}

/**
 * listChatSources — this user's saved sources (metadata only).
 * @returns {Promise<object[]>}
 */
export async function listChatSources(uid) {
  const { data } = await apiClient.get(ENDPOINTS.AI_CHAT.SOURCES(uid));
  if (!data.success) throw new Error(data.error || data.message || "Failed to load sources.");
  return data.data?.sources || [];
}

/**
 * getSourcesContent — full text per source (not just titles), used by
 * Mind Map / Audio Overview / PPT / Flashcards' "From Sources" mode.
 * @returns {Promise<{sourceId, title, text}[]>}
 */
export async function getSourcesContent(uid) {
  const { data } = await apiClient.get(ENDPOINTS.AI_CHAT.SOURCES_CONTENT(uid));
  if (!data.success) throw new Error(data.error || data.message || "Failed to load source content.");
  return data.data?.sources || [];
}

/** deleteChatSource — removes a source and its chunks entirely. */
export async function deleteChatSource(uid, sourceId) {
  const { data } = await apiClient.delete(ENDPOINTS.AI_CHAT.DELETE_SOURCE(uid, sourceId));
  if (!data.success) throw new Error(data.error || data.message || "Failed to remove source.");
}
