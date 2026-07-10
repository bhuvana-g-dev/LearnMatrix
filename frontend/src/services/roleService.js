import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";
import { ROLES } from "../constants/roles";

/**
 * Role service. Screens call this instead of importing ROLES directly, so
 * the data source can move to Flask without touching RoleSelectionScreen.
 */
export async function getRoles() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.ROLES.LIST);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(ROLES);
}
