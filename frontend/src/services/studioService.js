import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * studioService — Mind Map / Slide Deck artifacts saved per chat session
 * (see backend/services/studio_repository.py). Lets the AI Study Assistant
 * show "already generated" cards for the open chat (NotebookLM Studio-panel
 * style) and reopen one's exact saved content with no further AI call.
 */

/** Returns [{id, type: "mindmap"|"slidedeck", title, createdAt}, ...]. */
export async function listStudioArtifacts(uid, sessionId) {
  const { data } = await apiClient.get(ENDPOINTS.STUDIO.LIST(uid, sessionId));
  if (!data.success) throw new Error(data.error || data.message || "Couldn't load saved items.");
  return data.data;
}

/** Returns {type, title, content, createdAt} — `content` is the exact
 * MindMapAgent/SlideDeckAgent JSON, ready for MindMapView/SlideDeckPreview. */
export async function getStudioArtifact(uid, sessionId, artifactId) {
  const { data } = await apiClient.get(ENDPOINTS.STUDIO.GET(uid, sessionId, artifactId));
  if (!data.success) throw new Error(data.error || data.message || "Couldn't load that item.");
  return data.data;
}
