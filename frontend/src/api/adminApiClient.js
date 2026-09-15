import axios from "axios";
import { adminAuth } from "../firebase";

/**
 * Axios instance for every /api/admin/* call.
 *
 * Mirrors api/axiosClient.js, but reads the current user from `adminAuth`
 * (the isolated second Firebase App instance in firebase.js) instead of
 * the default `auth`. Admin login (services/adminAuthService.js) signs in
 * against `adminAuth`, not `auth` — so `auth.currentUser` is always null
 * for an admin who hasn't also separately logged in as a student, and the
 * shared apiClient's interceptor was silently sending admin requests with
 * no Authorization header at all. Every admin service module should
 * import THIS client, never api/axiosClient.js.
 */
const DEFAULT_TIMEOUT_MS = 30000;

const adminApiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

adminApiClient.interceptors.request.use(async (config) => {
  const currentUser = adminAuth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // Non-fatal — request still goes out without a token, and
      // require_admin() on the backend will reject it with a clear
      // 401 instead of this silently retrying forever.
    }
  }
  return config;
});

adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[Admin API Error]", error?.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default adminApiClient;
