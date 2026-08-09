import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * pptService — downloads a generated .pptx as a blob (through
 * apiClient, so the auth interceptor still attaches) and triggers a
 * normal browser file download. The backend routes here do NOT return
 * the usual {success, data, message} JSON envelope on success — they
 * stream the file directly — so these functions skip the usual
 * `data.success` check on the happy path.
 */
async function downloadBlob(url, fallbackFilename) {
  const response = await apiClient.get(url, { responseType: "blob", timeout: 60000 });
  await triggerDownload(response, fallbackFilename);
}

async function downloadBlobPost(url, body, fallbackFilename) {
  const response = await apiClient.post(url, body, { responseType: "blob", timeout: 60000 });
  await triggerDownload(response, fallbackFilename);
}

async function triggerDownload(response, fallbackFilename) {
  // A failed request with responseType "blob" still resolves as a blob
  // (Flask's JSON error envelope arrives as blob bytes) — if the server
  // sent JSON instead of a real pptx, surface that error message rather
  // than downloading a broken file.
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

/** From an already-generated Learning Hub notes entry. */
export async function downloadTopicSummaryPptx(skill, topic, focusBand) {
  await downloadBlob(ENDPOINTS.STUDY_SUMMARY.DOWNLOAD_TOPIC_PPTX(skill, topic, focusBand), `${topic}_study_summary.pptx`);
}

/** From the user's uploaded/linked chat sources. */
export async function downloadSourcesSummaryPptx(uid) {
  await downloadBlob(ENDPOINTS.STUDY_SUMMARY.DOWNLOAD_SOURCES_PPTX(uid), "sources_study_summary.pptx");
}

/** From one saved AI Chat session. */
export async function downloadChatSummaryPptx(uid, sessionId) {
  await downloadBlob(ENDPOINTS.STUDY_SUMMARY.DOWNLOAD_CHAT_PPTX(uid, sessionId), "chat_study_summary.pptx");
}

/** From text the student typed directly into the "Type" mode box. */
export async function downloadCustomTextPptx(text) {
  await downloadBlobPost(ENDPOINTS.STUDY_SUMMARY.DOWNLOAD_CUSTOM_PPTX, { text }, "custom_study_summary.pptx");
}
