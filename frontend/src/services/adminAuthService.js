import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { adminAuth as firebaseAuth } from "../firebase";
import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

const AUTH_TOKEN_KEY = "lm_auth_token";

export async function loginAdmin(credentials) {
  const email = (credentials?.email || credentials?.username || "").trim();
  const password = credentials?.password || "";

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const idToken = await userCredential.user.getIdToken();

  try {
    const { data } = await apiClient.post(ENDPOINTS.ADMIN.AUTH.SESSION, { idToken });
    localStorage.setItem(AUTH_TOKEN_KEY, idToken);
    return { success: true, token: idToken, admin: data.data };
  } catch (err) {
    await signOut(firebaseAuth);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    throw new Error(err?.response?.data?.error || "You don't have admin access.");
  }
}

function waitForFirebaseUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function restoreAdminSession() {
  const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!savedToken) return null;

  const currentUser = firebaseAuth.currentUser || (await waitForFirebaseUser());
  if (!currentUser) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return null;
  }

  try {
    const freshToken = await currentUser.getIdToken();
    const { data } = await apiClient.post(ENDPOINTS.ADMIN.AUTH.SESSION, { idToken: freshToken });
    localStorage.setItem(AUTH_TOKEN_KEY, freshToken);
    return { admin: data.data };
  } catch {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return null;
  }
}

export async function logoutAdmin() {
  await signOut(firebaseAuth);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  return { success: true };
}
