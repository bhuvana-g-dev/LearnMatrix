import { auth, googleProvider, githubProvider } from "../firebase";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";

export async function loginUser(credentials) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    credentials.email,
    credentials.password
  );

  return {
    success: true,
    user: userCredential.user,
  };
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);

  return {
    success: true,
    user: result.user,
  };
}

export async function loginWithGithub() {
  const result = await signInWithPopup(auth, githubProvider);

  return {
    success: true,
    user: result.user,
  };
}

export async function logoutUser() {
  await signOut(auth);

  return {
    success: true,
  };
}

export async function signupUser(name, email, password) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  try {
    await updateProfile(userCredential.user, { displayName: name });
  } catch {
    // Non-fatal — account still exists even if this write fails.
  }

  try {
    await sendEmailVerification(userCredential.user);
  } catch {
    // Non-fatal — the account still exists even if this send fails.
  }

  return {
    success: true,
    user: userCredential.user,
  };
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);

  return {
    success: true,
  };
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) {
    throw new Error("No user is currently signed in.");
  }
  await sendEmailVerification(auth.currentUser);

  return {
    success: true,
  };
}

export async function reloadCurrentUser() {
  if (!auth.currentUser) {
    throw new Error("No user is currently signed in.");
  }
  await auth.currentUser.reload();

  return {
    success: true,
    user: auth.currentUser,
  };
}
