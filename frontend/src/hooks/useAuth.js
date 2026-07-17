import { useState, useCallback } from "react";
import {
  loginUser,
  loginWithGoogle,
  loginWithGithub,
  logoutUser,
  signupUser,
  sendPasswordReset,
  resendVerificationEmail,
  reloadCurrentUser,
} from "../services/authService";

/**
 * useAuth — Authentication Hook
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    error,
    login,
    signup,
    loginGoogle,
    loginGithub,
    logout,
    resetPassword,
    resendVerification,
    refreshVerificationStatus,
  };
}
