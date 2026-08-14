import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * studioService — Mind Map / Slide Deck / Flashcards / Audio Overview
 * artifacts saved per chat session (see backend/services/studio_repository.py).
 * Lets the AI Study Assistant show "already generated" cards for the open
 * chat (NotebookLM Studio-panel style) and reopen one's exact saved content
 * with no further AI call.
 */

/** Returns [{id, type: "mindmap"|"slidedeck"|"flashcards"|"audio", title, createdAt}, ...]. */
export async function listStudioArtifacts(uid, sessionId) {
  const { data } = await apiClient.get(ENDPOINTS.STUDIO.LIST(uid, sessionId));
  if (!data.success) throw new Error(data.error || data.message || "Couldn't load saved items.");
  return data.data;
}

/** Returns {type, title, content, createdAt} — `content` is the exact
 * MindMapAgent/SlideDeckAgent/flashcard-set/audio-notes JSON, ready for
 * MindMapView/SlideDeckPreview/FlashcardModalBody/AudioOverviewDock. */
export async function getStudioArtifact(uid, sessionId, artifactId) {
  const { data } = await apiClient.get(ENDPOINTS.STUDIO.GET(uid, sessionId, artifactId));
  if (!data.success) throw new Error(data.error || data.message || "Couldn't load that item.");
  return data.data;
}

/** Saves a Flashcards or Audio Overview result as a studio artifact so it
 * shows up in the session's history strip next time — Mind Map/Slide Deck
 * save themselves as a side effect of their own generate calls (see
 * mindmapService.js/slideDeckService.js), but Flashcards/Audio Overview
 * don't have that same "backend call already knows the session" shape
 * (Flashcards is saved uid-scoped elsewhere; Audio Overview is built
 * entirely client-side), so the frontend saves them explicitly here. */
export async function saveStudioArtifact(uid, sessionId, type, title, content) {
  const { data } = await apiClient.post(ENDPOINTS.STUDIO.SAVE(uid, sessionId), { type, title, content });
  if (!data.success) throw new Error(data.error || data.message || "Couldn't save that item.");
  return data.data;
}
