import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

const ADMIN_TOKEN_KEY = "lm_admin_auth_token";
const ADMIN_USERNAME_KEY = "lm_admin_username";

// Fixed admin credentials for the current (pre-Flask-admin-auth) dummy
// layer. Previously ANY non-empty username/password combination was
// accepted — this is the actual gate until real backend admin auth
// (Flask + Firebase custom claims, see FUTURE block below) exists.
// Override via .env (VITE_ADMIN_USERNAME / VITE_ADMIN_PASSWORD) so the
// real values aren't hardcoded in the bundle for every deployment.
const ADMIN_USERNAME = import.meta.env?.VITE_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = import.meta.env?.VITE_ADMIN_PASSWORD || "learnmatrix";

/**
 * Admin auth service — separate from services/authService.js on purpose
 * (student vs admin are different actors/roles even though they may later
 * share the same Firebase project). Kept async/Promise-based, matching the
 * exact shape a real call will have, same convention as authService.js.
 */
export async function loginAdmin(credentials) {
  // ---- FUTURE (Flask + Firebase custom claims, e.g. role: "admin") ----
  // const { data } = await apiClient.post(ENDPOINTS.ADMIN.LOGIN, credentials);
  // localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
  // return data;

  // ---- CURRENT (dummy, but with a real credential check) ----
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const username = (credentials?.username || "").trim();
      const password = credentials?.password || "";

      if (!username || !password) {
        reject(new Error("Username and password are required."));
        return;
      }
      if (username.toLowerCase() !== ADMIN_USERNAME.toLowerCase() || password !== ADMIN_PASSWORD) {
        reject(new Error("Invalid admin username or password."));
        return;
      }

      const token = "dummy-admin-token";
      // Persisted so a page refresh doesn't bounce back to the login
      // screen — useAdminAuth reads this on mount to restore the session.
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      localStorage.setItem(ADMIN_USERNAME_KEY, username);

      resolve({
        success: true,
        token,
        admin: { username },
      });
    }, 250);
  });
}

// Restores the session on page load/refresh (useAdminAuth's initial
// state) — synchronous today (just a localStorage read), but kept
// Promise-based so the FUTURE real-token-verification call slots in
// here without changing how useAdminAuth calls it.
export async function restoreAdminSession() {
  // ---- FUTURE ----
  // const { data } = await apiClient.get(ENDPOINTS.ADMIN.ME);
  // return data.admin ? { admin: data.admin } : null;

  // ---- CURRENT (dummy) ----
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const username = localStorage.getItem(ADMIN_USERNAME_KEY);
  if (!token || !username) return null;
  return { admin: { username } };
}

export async function logoutAdmin() {
  // ---- FUTURE ----
  // await apiClient.post(ENDPOINTS.ADMIN.LOGOUT);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USERNAME_KEY);
  return Promise.resolve({ success: true });
}
