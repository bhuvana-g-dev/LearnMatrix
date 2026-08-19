import axios from "axios";

/**
 * Centralized Axios instance.
 *
 * Every service module imports THIS file instead of calling axios directly.
 * When the Flask backend goes live, only the baseURL (and interceptors, if
 * auth changes) need to be updated here — no screen/component code changes.
 */
// 30s, not 10s — Render's free tier spins the backend down after a
// stretch of inactivity, and cold-starting it back up alone can take
// 15-50s (see aiAssessmentService.js). ANY request can land right after
// an idle gap (not just question generation), so the global default
// needs enough room to survive a cold start, not just a warm request.
const DEFAULT_TIMEOUT_MS = 30000;

const apiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach a Firebase/Flask auth token automatically once real auth is wired in.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("lm_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralized error handling — extend later for token refresh, global
// toast notifications, forced re-login on 401, etc.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[API Error]", error?.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
