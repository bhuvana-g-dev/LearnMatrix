import apiClient from "../api/axiosClient";

export async function pingActivity(uid) {
  if (!uid) return;
  try {
    await apiClient.post(`/activity/ping/${uid}`);
  } catch {
    // Non-fatal — a missed streak ping shouldn't block anything else.
  }
}

export async function getActivity(uid) {
  const { data } = await apiClient.get(`/activity/${uid}`);
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load activity.");
  }
  return data.data.dates; // array of "YYYY-MM-DD" strings
}
