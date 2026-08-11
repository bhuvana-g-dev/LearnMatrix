import { useState, useCallback, useEffect } from "react";
import { loginAdmin, logoutAdmin, restoreAdminSession } from "../services/adminAuthService";

/**
 * useAdminAuth — the ONLY place admin screens touch admin auth state.
 * Mirrors hooks/useAuth.js exactly. Swapping dummy login for real
 * Firebase/Flask admin auth only requires editing services/adminAuthService.js.
 *
 * `initializing`: true until restoreAdminSession() resolves. AdminApp.jsx
 * waits for this before deciding to render Login vs the dashboard — like
 * useAuth's `initializing`, it's what stops a logged-in admin from
 * flashing to the Login screen for a frame on refresh (today the saved
 * session check is a synchronous localStorage read, but restoreAdminSession
 * is Promise-based so this keeps working once it's a real API call).
 */
export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    restoreAdminSession()
      .then((saved) => {
        if (!active) return;
        if (saved) {
          setIsAuthenticated(true);
          setAdmin(saved.admin);
        }
      })
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  return { isAuthenticated, admin, loading, error, initializing, login, logout };
}
