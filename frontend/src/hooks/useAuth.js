import { useState, useCallback, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth } from "../firebase";
import {
  loginUser,
  loginWithGoogle,
  loginWithGithub,
  logoutUser,
  signupUser,
  sendPasswordReset,
  resendVerificationEmail,
  reloadCurrentUser,
  updateUserEmail,
} from "../services/authService";
/**
 * useAuth — Authentication Hook
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // True until Firebase tells us whether a session already exists. Firebase
  // persists login across page refreshes in the browser by default, but
  // isAuthenticated/user here are just React state that resets on every
  // refresh — without this listener restoring them, refreshing ANY page
  // would incorrectly bounce a still-logged-in person back to Login.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthenticated(!!firebaseUser);
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Email Login
  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);

    try {
      const result = await loginUser(credentials);
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Account not found. Please Sign Up first.");
      } else {
        setError("Unable to login. Please try again.");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  // Email Signup — also signs the new user straight in (sets user +
  // isAuthenticated). App.jsx separately gates full access behind
  // user.emailVerified, so this lands them on the "verify your email"
  // screen rather than bouncing back to Login.
  const signup = useCallback(async (name, email, password) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signupUser(name, email, password);
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setError(err?.message || "Signup failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Google Login
  const loginGoogle = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loginWithGoogle();
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setError(err?.message || "Google login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // GitHub Login
  const loginGithub = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loginWithGithub();
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setError(err?.message || "GitHub login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await logoutUser();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  // Forgot Password — sends a Firebase reset-link email.
  const resetPassword = useCallback(async (email) => {
    setError(null);
    try {
      await sendPasswordReset(email);
      return { success: true };
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with that email.");
      } else if (err.code === "auth/invalid-email") {
        setError("That doesn't look like a valid email address.");
      } else {
        setError("Unable to send reset email. Please try again.");
      }
      throw err;
    }
  }, []);

  // Resends the email-verification link (used on the "verify your email" gate).
  const resendVerification = useCallback(async () => {
    await resendVerificationEmail();
    return { success: true };
  }, []);

  // Lets someone fix a typo'd signup email from the "verify your email"
  // gate — sends the verification link to the corrected address instead.
  // The account's email only actually changes once that new link is
  // clicked, so a mistyped address here can't be abused to take over
  // someone else's inbox.
  const changeEmail = useCallback(async (newEmail) => {
    try {
      await updateUserEmail(newEmail);
      return { success: true };
    } catch (err) {
      if (err.code === "auth/invalid-email") {
        throw new Error("That doesn't look like a valid email address.");
      }
      if (err.code === "auth/email-already-in-use") {
        throw new Error("That email is already registered to another account.");
      }
      if (err.code === "auth/requires-recent-login") {
        throw new Error("For security, please log out and log back in, then try again.");
      }
      throw new Error(err?.message || "Couldn't update your email. Try again.");
    }
  }, []);

  // Re-fetches the current user from Firebase so a just-clicked
  // verification link is reflected in emailVerified without a full re-login.
  // NOTE: Firebase's reload() mutates the existing user object in place and
  // returns that same reference — passing it straight to setUser() would be
  // a no-op in React's eyes (same object === no change === no re-render).
  // Spreading into a new plain object forces React to actually update.
  const refreshVerificationStatus = useCallback(async () => {
    const { user: refreshedUser } = await reloadCurrentUser();
    const freshCopy = refreshedUser ? { ...refreshedUser } : refreshedUser;
    setUser(freshCopy);
    return freshCopy?.emailVerified ?? false;
  }, []);

  return {
    isAuthenticated,
    user,
    loading,
    initializing,
    error,
    login,
    signup,
    loginGoogle,
    loginGithub,
    logout,
    resetPassword,
    resendVerification,
    refreshVerificationStatus,
    changeEmail,
  };
}import { useState, useCallback, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth } from "../firebase";
import {
  loginUser,
  loginWithGoogle,
  loginWithGithub,
  logoutUser,
  signupUser,
  sendPasswordReset,
  resendVerificationEmail,
  reloadCurrentUser,
  updateUserEmail,
} from "../services/authService";
/**
 * useAuth — Authentication Hook
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // True until Firebase tells us whether a session already exists. Firebase
  // persists login across page refreshes in the browser by default, but
  // isAuthenticated/user here are just React state that resets on every
  // refresh — without this listener restoring them, refreshing ANY page
  // would incorrectly bounce a still-logged-in person back to Login.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthenticated(!!firebaseUser);
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Email Login
  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);

    try {
      const result = await loginUser(credentials);
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Account not found. Please Sign Up first.");
      } else {
        setError("Unable to login. Please try again.");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  // Email Signup — also signs the new user straight in (sets user +
  // isAuthenticated). App.jsx separately gates full access behind
  // user.emailVerified, so this lands them on the "verify your email"
  // screen rather than bouncing back to Login.
  const signup = useCallback(async (name, email, password) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signupUser(name, email, password);
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setError(err?.message || "Signup failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Google Login
  const loginGoogle = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loginWithGoogle();
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setError(err?.message || "Google login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // GitHub Login
  const loginGithub = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loginWithGithub();
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setError(err?.message || "GitHub login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await logoutUser();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  // Forgot Password — sends a Firebase reset-link email.
  const resetPassword = useCallback(async (email) => {
    setError(null);
    try {
      await sendPasswordReset(email);
      return { success: true };
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with that email.");
      } else if (err.code === "auth/invalid-email") {
        setError("That doesn't look like a valid email address.");
      } else {
        setError("Unable to send reset email. Please try again.");
      }
      throw err;
    }
  }, []);

  // Resends the email-verification link (used on the "verify your email" gate).
  const resendVerification = useCallback(async () => {
    await resendVerificationEmail();
    return { success: true };
  }, []);

  // Lets someone fix a typo'd signup email from the "verify your email"
  // gate — sends the verification link to the corrected address instead.
  // The account's email only actually changes once that new link is
  // clicked, so a mistyped address here can't be abused to take over
  // someone else's inbox.
  const changeEmail = useCallback(async (newEmail) => {
    try {
      await updateUserEmail(newEmail);
      return { success: true };
    } catch (err) {
      if (err.code === "auth/invalid-email") {
        throw new Error("That doesn't look like a valid email address.");
      }
      if (err.code === "auth/email-already-in-use") {
        throw new Error("That email is already registered to another account.");
      }
      if (err.code === "auth/requires-recent-login") {
        throw new Error("For security, please log out and log back in, then try again.");
      }
      throw new Error(err?.message || "Couldn't update your email. Try again.");
    }
  }, []);

  // Re-fetches the current user from Firebase so a just-clicked
  // verification link is reflected in emailVerified without a full re-login.
  // NOTE: Firebase's reload() mutates the existing user object in place and
  // returns that same reference — passing it straight to setUser() would be
  // a no-op in React's eyes (same object === no change === no re-render).
  // Spreading into a new plain object forces React to actually update.
  const refreshVerificationStatus = useCallback(async () => {
    const { user: refreshedUser } = await reloadCurrentUser();
    const freshCopy = refreshedUser ? { ...refreshedUser } : refreshedUser;
    setUser(freshCopy);
    return freshCopy?.emailVerified ?? false;
  }, []);

  return {
    isAuthenticated,
    user,
    loading,
    initializing,
    error,
    login,
    signup,
    loginGoogle,
    loginGithub,
    logout,
    resetPassword,
    resendVerification,
    refreshVerificationStatus,
    changeEmail,
  };
}
