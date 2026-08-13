import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * slideDeckService — the "Type" mode flow for Slide Deck: first AI-expand
 * the student's short prompt into full deck content for an in-app preview
 * (generateSlideDeckPreview), then download exactly that previewed content
 * as a file (downloadDeckContentPptx/Pdf) — no second AI call, so the file
 * always matches what was shown on screen.
 */

const GENERATE_TIMEOUT_MS = 60000; // LLM call — same reasoning as mindmapService/aiChatService

/** Returns {title, summary, sections, keyTakeaways}. Passing uid/sessionId
 * (i.e. generated from inside an open chat) also saves the result as a
 * studio artifact for that session (see services/studioService.js) so it
 * can be reopened later without regenerating. */
export async function generateSlideDeckPreview(text, uid, sessionId) {
  const { data } = await apiClient.post(ENDPOINTS.SLIDEDECK.GENERATE, { text, uid, sessionId }, { timeout: GENERATE_TIMEOUT_MS });
  if (!data.success) throw new Error(data.error || data.message || "Couldn't generate the slide deck.");
  return data.data;
}

async function downloadBlobFromContent(url, notes, fallbackFilename) {
  const response = await apiClient.post(url, { notes }, { responseType: "blob", timeout: 60000 });
  if (response.data.type === "application/json") {
    const text = await response.data.text();
    const parsed = JSON.parse(text);
    throw new Error(parsed.error || parsed.message || "Couldn't generate the study summary.");
  }
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function downloadDeckContentPptx(notes) {
  const filename = `${(notes.title || "custom").replace(/\s+/g, "_")}_study_summary.pptx`;
  await downloadBlobFromContent(ENDPOINTS.STUDY_SUMMARY.DOWNLOAD_CUSTOM_PPTX_FROM_CONTENT, notes, filename);
}

export async function downloadDeckContentPdf(notes) {
  const filename = `${(notes.title || "custom").replace(/\s+/g, "_")}_study_summary.pdf`;
  await downloadBlobFromContent(ENDPOINTS.STUDY_SUMMARY.DOWNLOAD_CUSTOM_PDF_FROM_CONTENT, notes, filename);
}
