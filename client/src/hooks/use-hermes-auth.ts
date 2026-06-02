/**
 * useHermesAuth — manages the Hermes token stored in localStorage.
 *
 * Returns:
 *   token       — the current token string (or null)
 *   isSuperAdmin — true if authenticated via token (full access)
 *   isAdmin     — true if authenticated via main-app session (read-only)
 *   logout      — clears the token
 *   authHeader  — { Authorization: "Bearer <token>" } for fetch calls
 *
 * The hook also checks the /api/hermes/me endpoint on mount to validate
 * the token and determine the access level.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

export interface HermesIdentity {
  role: "superadmin" | "admin" | "user";
  via: "token" | "session";
  email?: string;
}

export function useHermesAuth() {
  const { isAdmin: isMainAdmin, isSuperAdmin: isMainSuperAdmin } = useAuth();
  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem("hermes_token");
    const exp = localStorage.getItem("hermes_token_exp");
    if (!t) return null;
    if (exp && Date.now() > parseInt(exp)) {
      localStorage.removeItem("hermes_token");
      localStorage.removeItem("hermes_token_exp");
      return null;
    }
    return t;
  });
  const [hermesIdentity, setHermesIdentity] = useState<HermesIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("hermes_token");
    localStorage.removeItem("hermes_token_exp");
    setToken(null);
    setHermesIdentity(null);
  }, []);

  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Validate token / session on mount
  useEffect(() => {
    let cancelled = false;
    async function verify() {
      setLoading(true);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/hermes/me", {
          credentials: "include",
          headers,
        });
        if (!cancelled) {
          if (res.ok) {
            const { hermesUser } = await res.json();
            setHermesIdentity(hermesUser);
          } else {
            // Token invalid — clear it
            if (token) logout();
            setHermesIdentity(null);
          }
        }
      } catch {
        if (!cancelled) setHermesIdentity(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    verify();
    return () => { cancelled = true; };
  }, [token]);

  const isSuperAdmin = hermesIdentity?.via === "token";
  const isAdmin = !!hermesIdentity; // either token or session

  return {
    token,
    hermesIdentity,
    isSuperAdmin,
    isAdmin,
    loading,
    logout,
    authHeader,
    // Whether the user can even see the Hermes dashboard (admin+ via main session)
    canAccessDashboard: isAdmin || isMainAdmin,
  };
}
