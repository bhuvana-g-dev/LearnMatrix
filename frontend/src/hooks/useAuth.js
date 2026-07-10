import { useState, useCallback } from "react";
import { loginUser, loginWithGoogle, loginWithGithub, logoutUser } from "../services/authService";

/**
 * useAuth — the ONLY place screens touch auth state or authService.
 * Swapping dummy login for real Flask/Firebase auth only requires editing
 * services/authService.js; this hook and LoginScreen stay untouched.
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginUser(credentials);
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setError(err?.message || "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginGoogle = useCallback(async () => {
    const result = await loginWithGoogle();
    setIsAuthenticated(true);
    return result;
  }, []);

  const loginGithub = useCallback(async () => {
    const result = await loginWithGithub();
    setIsAuthenticated(true);
    return result;
  }, []);

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
    loginGoogle,
    loginGithub,
    logout,
  };
}
