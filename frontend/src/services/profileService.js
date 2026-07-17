import { auth } from "../firebase";
import { getUserProfileDoc } from "./userProfileService";
import { USER_PROFILE } from "../constants/userProfile";
export async function getUserProfile() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.PROFILE.ME);
  // return data;

  // ---- CURRENT ----
  // fullName/email come from Firebase Auth; college, department,
  // academicYear, mobile, and avatarUrl come from the Firestore doc
  // saved by CompleteProfileScreen (users/{uid}). USER_PROFILE only
  // fills in anything still missing (e.g. careerPath, joinedDate) as a
  // fallback so the rest of the page doesn't break.
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
