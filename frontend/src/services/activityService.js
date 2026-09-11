import apiClient from "../api/axiosClient";
import { getActivityDirect } from "./directProfileReads";

export async function pingActivity(uid) {
  if (!uid) return;
  try {
    // Server has no idea what "today" means for this student — UTC
    // rolls its calendar day over at 5:30 AM IST, which would log
    // late-night activity under the wrong date. Send the student's
    // own local date string; the server just records what it's given.
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    await apiClient.post(`/activity/ping/${uid}`, { local_date: localDate });
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
