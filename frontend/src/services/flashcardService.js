import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

const GENERATION_TIMEOUT_MS = 60000; // same reasoning as aiChatService — cold starts + LLM retries

/**
 * generateFlashcardsFromTopic — new set from an already-generated
 * Learning Hub notes entry.
 * @returns {Promise<{setId: string, title: string, cards: {question, answer}[]}>}
 */
export async function generateFlashcardsFromTopic(uid, skill, topic, focusBand, count) {
  const { data } = await apiClient.post(
    ENDPOINTS.FLASHCARDS.GENERATE,
    { uid, mode: "topic", skill, topic, focusBand, count },
    { timeout: GENERATION_TIMEOUT_MS }
  );
  if (!data.success) throw new Error(data.error || data.message || "Couldn't generate flashcards.");
  return data.data;
}

/**
 * generateFlashcardsFromChat — new set from one saved AI Chat SESSION.
 * @param {string} sessionId - required; the conversation to draw from
 * @returns {Promise<{setId: string, title: string, cards: {question, answer}[]}>}
 */
export async function generateFlashcardsFromChat(uid, sessionId, count) {
  const { data } = await apiClient.post(
    ENDPOINTS.FLASHCARDS.GENERATE,
    { uid, mode: "chat", sessionId, count },
    { timeout: GENERATION_TIMEOUT_MS }
  );
  if (!data.success) throw new Error(data.error || data.message || "Couldn't generate flashcards.");
  return data.data;
}

/**
 * generateFlashcardsFromSources — new set from the user's
 * uploaded/linked chat sources.
 * @returns {Promise<{setId: string, title: string, cards: {question, answer}[]}>}
 */
export async function generateFlashcardsFromSources(uid, count) {
  const { data } = await apiClient.post(
    ENDPOINTS.FLASHCARDS.GENERATE,
    { uid, mode: "sources", count },
    { timeout: GENERATION_TIMEOUT_MS }
  );
  if (!data.success) throw new Error(data.error || data.message || "Couldn't generate flashcards.");
  return data.data;
}

/**
 * generateFlashcardsFromCustomText — new set from text the student
 * typed directly into the "Type" mode box.
 * @returns {Promise<{setId: string, title: string, cards: {question, answer}[]}>}
 */
export async function generateFlashcardsFromCustomText(uid, text, count) {
  const { data } = await apiClient.post(
    ENDPOINTS.FLASHCARDS.GENERATE,
    { uid, mode: "custom", text, count },
    { timeout: GENERATION_TIMEOUT_MS }
  );
  if (!data.success) throw new Error(data.error || data.message || "Couldn't generate flashcards.");
  return data.data;
}

/** @returns {Promise<object[]>} saved flashcard sets, newest first */
export async function listFlashcardSets(uid) {
  const { data } = await apiClient.get(ENDPOINTS.FLASHCARDS.LIST(uid));
  if (!data.success) throw new Error(data.error || data.message || "Failed to load flashcard sets.");
  return data.data?.sets || [];
}

export async function deleteFlashcardSet(uid, setId) {
  const { data } = await apiClient.delete(ENDPOINTS.FLASHCARDS.DELETE(uid, setId));
  if (!data.success) throw new Error(data.error || data.message || "Failed to delete flashcard set.");
}
