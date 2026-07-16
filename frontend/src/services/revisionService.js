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

export async function snoozeRevision(id) {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.post(ENDPOINTS.REVISION.SNOOZE(id));
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve({ id, bucket: "upcoming", date: "Tomorrow" });
}
