import apiClient from "../api/axiosClient";
import { getActivityDirect } from "./directProfileReads";

export async function pingActivity(uid) {
  if (!uid) return;
  try {
    await apiClient.post(`/activity/ping/${uid}`);
  } catch {
    // Non-fatal — a missed streak ping shouldn't block anything else.
  }
}

// Direct-Firestore-first: learning_activity/{uid} is a plain read (no
// backend computation), so there's no reason to wait on Render for it.
// Falls back to the Flask route only if the direct read itself throws.
export async function getActivity(uid) {
  try {
    return await getActivityDirect(uid);
  } catch {
    const { data } = await apiClient.get(`/activity/${uid}`);
    if (!data.success) {
      throw new Error(data.error || data.message || "Failed to load activity.");
    }
    return data.data.dates; // array of "YYYY-MM-DD" strings
  }
}
