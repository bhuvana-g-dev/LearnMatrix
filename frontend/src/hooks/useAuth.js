import { useState, useCallback } from "react";
import {
  loginUser,
  loginWithGoogle,
  loginWithGithub,
  logoutUser,
  signupUser,
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
}
     finally {
      setLoading(false);
    }
  }, []);

  // Email Signup
  const signup = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signupUser(email, password);
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
  };
}