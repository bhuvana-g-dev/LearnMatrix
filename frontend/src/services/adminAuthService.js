import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * Admin auth service — separate from services/authService.js on purpose
 * (student vs admin are different actors/roles even though they may later
 * share the same Firebase project). Kept async/Promise-based, matching the
 * exact shape a real call will have, same convention as authService.js.
 */
export async function loginAdmin(credentials) {
  // ---- FUTURE (Flask + Firebase custom claims, e.g. role: "admin") ----
  // const { data } = await apiClient.post(ENDPOINTS.ADMIN.LOGIN, credentials);
  // localStorage.setItem("lm_admin_auth_token", data.token);
  // return data;

  // ---- CURRENT (dummy) ----
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!credentials?.email || !credentials?.password) {
        reject(new Error("Email and password are required."));
        return;
      }
      resolve({
        success: true,
        token: "dummy-admin-token",
        admin: { email: credentials.email },
      });
    }, 250);
  });
}

export async function logoutAdmin() {
  // ---- FUTURE ----
  // await apiClient.post(ENDPOINTS.ADMIN.LOGOUT);
  localStorage.removeItem("lm_admin_auth_token");
  return Promise.resolve({ success: true });
}
