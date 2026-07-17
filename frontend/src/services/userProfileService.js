import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// Each signed-up user gets one Firestore document at users/{uid} holding
// the fields we don't get for free from Firebase Auth: college,
// department, academicYear, mobile, avatarUrl (stored as a base64 data
// URI here — no Firebase Storage needed), and a profileComplete flag.

export async function getUserProfileDoc(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserProfileDoc(uid, data) {
  if (!uid) throw new Error("Missing user id");
  await setDoc(
    doc(db, "users", uid),
    {
      ...data,
      profileComplete: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { success: true };
}
