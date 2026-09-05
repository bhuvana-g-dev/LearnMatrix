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
  GoogleAuthProvider,
  GithubAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
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

// Builds the richer error useAuth.js needs to walk someone through
// account linking when Google/GitHub sign-in collides with an email
// that's already registered under a different provider. Firebase's own
// error only carries a generic message — this adds the pending
// credential (so it can be attached to the RIGHT account once the user
// proves ownership of it) and the list of sign-in methods that email
// already has, so the caller knows which provider to ask them to use.
async function _enrichAccountExistsError(err, ProviderClass) {
  if (err?.code !== "auth/account-exists-with-different-credential") {
    throw err;
  }
  const pendingCred = ProviderClass.credentialFromError(err);
  const email = err.customData?.email;
  let existingMethods = [];
  if (email) {
    try {
      existingMethods = await fetchSignInMethodsForEmail(auth, email);
    } catch {
      // Non-fatal — linkError below still carries enough for a generic
      // "already registered elsewhere" message even without the list.
    }
  }
  const linkError = new Error(
    existingMethods.includes("google.com")
      ? `This email is already signed up with Google. Sign in with Google to connect this to your account.`
      : existingMethods.includes("password")
      ? `This email already has a password account. Log in with your email & password to connect this to your account.`
      : `This email is already registered with a different sign-in method.`
  );
  linkError.code = err.code;
  linkError.pendingCred = pendingCred;
  linkError.email = email;
  linkError.existingMethods = existingMethods;
  throw linkError;
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { success: true, user: result.user };
  } catch (err) {
    await _enrichAccountExistsError(err, GoogleAuthProvider);
  }
}

export async function loginWithGithub() {
  try {
    const result = await signInWithPopup(auth, githubProvider);
    return { success: true, user: result.user };
  } catch (err) {
    await _enrichAccountExistsError(err, GithubAuthProvider);
  }
}

// Attaches a pending Google/GitHub credential (from the enriched error
// above) to whichever account is CURRENTLY signed in. Call this right
// after the user has signed back in via their original provider —
// see useAuth.js's maybeCompleteLink, which does this automatically the
// moment it sees a matching email, no matter which login path got them
// there (email/password, Google, or GitHub).
export async function linkPendingCredential(pendingCred) {
  if (!auth.currentUser) {
    throw new Error("You need to be signed in first to connect this account.");
  }
  if (!pendingCred) {
    throw new Error("Nothing to connect — please try again.");
  }
  const result = await linkWithCredential(auth.currentUser, pendingCred);
  return { success: true, user: result.user };
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
