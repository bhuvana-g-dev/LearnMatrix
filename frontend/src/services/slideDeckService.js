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
 * Check whether the premium Gamma-powered slide deck path is enabled
 * on the backend (GAMMA_API_KEY configured) — call once (e.g. when
 * the Slide Deck "Type" modal opens) to decide whether to show a
 * "Premium (Gamma)" option at all.
 *
 * Returns: boolean
 */
export async function getSlideDeckPremiumStatus() {
  const { data } = await apiClient.get(ENDPOINTS.SLIDEDECK.PREMIUM_STATUS);
  return Boolean(data?.data?.available);
}


/**
 * Generate a slide deck via the premium Gamma path and trigger its
 * download directly — unlike generateSlideDeckPreview() above, Gamma
 * returns a finished file (no editable {sections: [...]} JSON), so
 * there's no in-app preview step for this path.
 *
 * format: "pptx" | "pdf" (default "pptx")
 * Returns the Gamma project URL (string, may be "") so the caller can
 * also offer an "Open in Gamma" link alongside the downloaded file.
 */
export async function generateSlideDeckPremium(
  text,
  label,
  format = "pptx"
) {
  const response = await apiClient.post(
    ENDPOINTS.SLIDEDECK.GENERATE_PREMIUM,
    { text, label, format },
    {
      responseType: "blob",
      timeout: GENERATE_TIMEOUT_MS,
    }
  );

  if (response.data.type === "application/json") {
    const text = await response.data.text();
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }
    throw new Error(
      parsed.error || parsed.message || "Couldn't generate the premium slide deck."
    );
  }

  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `slide_deck_gamma.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);

  return response.headers["x-gamma-url"] || "";
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
