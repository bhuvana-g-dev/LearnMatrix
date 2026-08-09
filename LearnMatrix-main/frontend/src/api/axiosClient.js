import axios from "axios";

/**
 * Centralized Axios instance.
 *
 * Every service module imports THIS file instead of calling axios directly.
 * When the Flask backend goes live, only the baseURL (and interceptors, if
 * auth changes) need to be updated here — no screen/component code changes.
 */
const apiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 10000,
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
