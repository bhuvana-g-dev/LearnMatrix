import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

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
