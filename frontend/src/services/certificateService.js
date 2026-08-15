import apiClient from "../api/axiosClient";

/**
 * certificateService.js
 *
 * Real API call to backend/routes/certificate_routes.py — replaces the
 * old dummy/local CERTIFICATES constant. A student has exactly one
 * active certificate at a time, tied to whatever career path their
 * current roadmap is for (backend/services/certificate_service.py):
 * it's created the moment they start a career path, and the backend
 * auto-flips it to "completed" the moment their roadmap's mastered
 * skills reach the total — checked live on every fetch, so this never
 * needs a separate "mark complete" call.
 *
 * Deliberately doesn't include the student's name — that comes from
 * whatever profile data the screen already has (useProfileDashboard),
 * so the certificate never shows a stale name.
 *
 * @param {string} uid
 * @returns {Promise<object|null>} null if the student hasn't started a
 *   career path yet.
 */
export async function getCertificate(uid) {
  const { data } = await apiClient.get(`/certificates/${uid}`);
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load certificate.");
  }
  return data.data; // null if none started yet
}
