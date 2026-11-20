import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { SessionUser } from "../../shared/types";
import { getMe, signOut as apiSignOut, track } from "./api";
import { clearDraft } from "./storage";

interface AuthState {
  user: SessionUser | null;
  /** True until the first session check has finished. */
  loading: boolean;
  refresh: () => Promise<SessionUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Adds the Cloudflare Web Analytics beacon when a site token is configured. */
function loadBeacon(token: string): void {
  if (document.querySelector("script[data-cf-beacon]")) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token, spa: true }));
  document.head.appendChild(script);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me.user);
      if (me.analyticsToken) loadBeacon(me.analyticsToken);
      return me.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // One page view per navigation. Admin pages are not counted as site traffic.
  useEffect(() => {
    if (!location.pathname.startsWith("/admin")) track("page_view");
  }, [location.pathname]);

  const signOut = useCallback(async () => {
    await apiSignOut().catch(() => undefined);
    // Nothing from the account may remain in this browser for the next person who uses it.
    clearDraft();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, signOut }), [user, loading, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
