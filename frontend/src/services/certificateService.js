import apiClient from "../api/axiosClient";

/**
 * certificateService.js
 *
 * Handles certificate-related API calls.
 *
 * A student has one active certificate at a time,
 * associated with their current career roadmap.
 */

/**
 * Get the student's certificate.
 *
 * @param {string} uid - Student Firebase/User UID
 * @returns {Promise<object|null>} Certificate data,
 * or null if the student has not started a career path yet.
 */
export async function getCertificate(uid) {
  const { data } = await apiClient.get(`/certificates/${uid}`);

  if (!data.success) {
    throw new Error(
      data.error ||
      data.message ||
      "Failed to load certificate."
    );
  }

  return data.data;
}
