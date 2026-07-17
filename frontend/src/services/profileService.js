import { auth } from "../firebase";
import { getUserProfileDoc } from "./userProfileService";
import { USER_PROFILE } from "../constants/userProfile";

export async function getUserProfile() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.PROFILE.ME);
  // return data;

  // ---- CURRENT ----
  const currentUser = auth.currentUser;
  let firestoreData = {};

  if (currentUser) {
    try {
      firestoreData = (await getUserProfileDoc(currentUser.uid)) || {};
    } catch {
      // Firestore unreachable — fall back to defaults below.
    }
  }

  return Promise.resolve({
    ...USER_PROFILE,
    ...firestoreData,
    fullName: currentUser?.displayName || firestoreData.fullName || USER_PROFILE.fullName,
    email: currentUser?.email || USER_PROFILE.email,
  });
}
