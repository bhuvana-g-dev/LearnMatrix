import { auth, googleProvider, githubProvider } from "../firebase";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
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

// Used from VerifyEmailScreen when someone typo'd their address at signup
// (e.g. missed a letter in their own username, like
// "selvameenakshi@gmail.com" instead of "selvameenakshik@gmail.com"). A
// typo like this can't be caught by any regex or domain check — the typo'd
// address is still syntactically valid and may even belong to someone
// else. verifyBeforeUpdateEmail sends the verification link to the NEW
// address and only swaps the account's email over once that link is
// clicked, so the old typo'd address is never trusted on its own.
export async function updateUserEmail(newEmail) {
  if (!auth.currentUser) {
    throw new Error("No user is currently signed in.");
  }
  await verifyBeforeUpdateEmail(auth.currentUser, newEmail);

  return {
    success: true,
  };
}
