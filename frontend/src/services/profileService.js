import { auth } from "../firebase";
import { getUserProfileDoc } from "./userProfileService";
import { USER_PROFILE } from "../constants/userProfile";

export async function getUserProfile() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.PROFILE.ME);
  // return data;

  // ---- CURRENT ----
  // fullName/email/joinedDate come from Firebase Auth (real account data).
  // college, department, academicYear, mobile, avatarUrl, and careerPath
  // come from the Firestore doc (users/{uid}) — careerPath is written by
  // App.jsx once the user finishes Role + Skill selection. USER_PROFILE
  // only fills in whatever's still missing as a fallback.
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
    joinedDate: currentUser?.metadata?.creationTime || firestoreData.joinedDate || USER_PROFILE.joinedDate,
    careerPath: firestoreData.careerPath || USER_PROFILE.careerPath,
  });
}
