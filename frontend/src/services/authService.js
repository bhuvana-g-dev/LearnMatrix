import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * Dummy auth service.
 *
 * Kept async and Promise-based on purpose, matching the exact shape a real
 * call will have — so LoginScreen never needs to change when this function's
 * INSIDE is swapped for a real Flask / Firebase Auth call.
 */
export async function loginUser(credentials) {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.post(ENDPOINTS.AUTH.LOGIN, credentials);
  // localStorage.setItem("lm_auth_token", data.token);
  // return data;

  // ---- CURRENT (dummy) ----
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        token: "dummy-local-token",
        user: { email: credentials?.email || "guest@learnmatrix.dev" },
      });
    }, 250);
  });
}

export async function loginWithGoogle() {
  // ---- FUTURE (Firebase Auth) ----
  // const { data } = await apiClient.post(ENDPOINTS.AUTH.GOOGLE, { idToken });
  // return data;
  return Promise.resolve({ success: true, provider: "google" });
}

export async function loginWithGithub() {
  // ---- FUTURE ----
  // const { data } = await apiClient.post(ENDPOINTS.AUTH.GITHUB, { code });
  // return data;
  return Promise.resolve({ success: true, provider: "github" });
}

export async function logoutUser() {
  // ---- FUTURE ----
  // await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
  localStorage.removeItem("lm_auth_token");
  return Promise.resolve({ success: true });
}
