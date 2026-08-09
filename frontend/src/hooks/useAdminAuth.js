import { useState, useCallback } from "react";
import { loginAdmin, logoutAdmin } from "../services/adminAuthService";

/**
 * useAdminAuth — the ONLY place admin screens touch admin auth state.
 * Mirrors hooks/useAuth.js exactly. Swapping dummy login for real
 * Firebase/Flask admin auth only requires editing services/adminAuthService.js.
 */
export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginAdmin(credentials);
      setAdmin(result.admin);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setError(err?.message || "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutAdmin();
    setIsAuthenticated(false);
    setAdmin(null);
  }, []);

  return { isAuthenticated, admin, loading, error, login, logout };
}
