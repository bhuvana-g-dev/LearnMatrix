import { USER_PROFILE } from "../constants/userProfile";

export async function getUserProfile() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.PROFILE.ME);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(USER_PROFILE);
}
