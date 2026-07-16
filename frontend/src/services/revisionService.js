import { REVISION_SCHEDULE } from "../constants/revisionSchedule";

export async function getRevisionSchedule() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.REVISION.SCHEDULE);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(REVISION_SCHEDULE);
}

export async function markRevisionCompleted(id) {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.post(ENDPOINTS.REVISION.COMPLETE(id));
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve({ id, completed: true });
}
