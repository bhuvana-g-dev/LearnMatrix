import axios from "axios";
import { auth } from "../firebase";

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

// Attach a fresh Firebase ID token to every request. Backend routes
// that take a <uid> (chat, roadmap, flashcards, activity, ...) now
// verify this token server-side and reject it if it doesn't belong to
// the uid being requested (utils/user_auth.py) — so this interceptor
// reading `auth.currentUser` live (instead of a possibly-stale cached
// string) is what makes those checks actually pass for real users.
// Async interceptors are supported by axios — it awaits this before
// sending the request.
apiClient.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // Non-fatal — request still goes out without a token, and any
      // route that requires one will reject it with a clear 401
      // instead of this silently retrying forever.
    }
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
