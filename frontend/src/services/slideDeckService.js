import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * slideDeckService — Slide Deck generation service.
 *
 * The timeout is increased because AI slide generation can take
 * longer than a normal chat response.
 */

// Slide deck AI generation timeout: 3 minutes
const GENERATE_TIMEOUT_MS = 180000;

// PPT/PDF generation timeout: 3 minutes
const DOWNLOAD_TIMEOUT_MS = 180000;


/**
 * Generate slide deck preview.
 *
 * Returns:
 * {
 *   title,
 *   summary,
 *   sections,
 *   keyTakeaways
 * }
 */
export async function generateSlideDeckPreview(
  text,
  uid,
  sessionId
) {
  const { data } = await apiClient.post(
    ENDPOINTS.SLIDEDECK.GENERATE,
    {
      text,
      uid,
      sessionId,
    },
    {
      timeout: GENERATE_TIMEOUT_MS,
    }
  );

  if (!data.success) {
    throw new Error(
      data.error ||
      data.message ||
      "Couldn't generate the slide deck."
    );
  }

  return data.data;
}


/**
 * Download generated deck as blob.
 */
async function downloadBlobFromContent(
  url,
  notes,
  fallbackFilename
) {
  const response = await apiClient.post(
    url,
    {
      notes,
    },
    {
      responseType: "blob",
      timeout: DOWNLOAD_TIMEOUT_MS,
    }
  );

  // Check if backend returned JSON error
  if (response.data.type === "application/json") {
    const text = await response.data.text();

    let parsed = {};

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    throw new Error(
      parsed.error ||
      parsed.message ||
      "Couldn't generate the study summary."
    );
  }

  // Create downloadable file
  const blobUrl = URL.createObjectURL(
    response.data
  );

  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = fallbackFilename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(blobUrl);
}


/**
 * Download Slide Deck as PPTX.
 */
export async function downloadDeckContentPptx(
  notes
) {
  const filename =
    `${(notes.title || "custom")
      .replace(/\s+/g, "_")}_study_summary.pptx`;

  await downloadBlobFromContent(
    ENDPOINTS.STUDY_SUMMARY
      .DOWNLOAD_CUSTOM_PPTX_FROM_CONTENT,
    notes,
    filename
  );
}


/**
 * Download Slide Deck as PDF.
 */
export async function downloadDeckContentPdf(
  notes
) {
  const filename =
    `${(notes.title || "custom")
      .replace(/\s+/g, "_")}_study_summary.pdf`;

  await downloadBlobFromContent(
    ENDPOINTS.STUDY_SUMMARY
      .DOWNLOAD_CUSTOM_PDF_FROM_CONTENT,
    notes,
    filename
  );
}
