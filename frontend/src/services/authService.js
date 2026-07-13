import { auth, googleProvider, githubProvider } from "../firebase";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
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

export async function signupUser(email, password) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  return {
    success: true,
    user: userCredential.user,
  };
}