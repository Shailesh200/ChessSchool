import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, clearToken, getToken, setUnauthorizedHandler } from "./api";
import { progressStore, fetchProgress, syncProgressAfterAuth, clearGuestProgress } from "./progressStore";
import { loadSettingsFromAccount, settings } from "./settings";

export type User = { id: string; name: string; email: string; role: string };

type AuthState = {
  user: User | null;
  guest: boolean;
  loading: boolean;
  needsOnboarding: boolean;
  finishOnboarding: () => void;
  continueAsGuest: () => void;
  exitGuest: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const GUEST_USER: User = { id: "guest", name: "Guest", email: "", role: "guest" };

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // An expired session anywhere → drop to the login screen instead of silent failures.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      progressStore.clear();
      setGuest(false);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const continueAsGuest = () => {
    void clearGuestProgress();
    void clearToken();
    progressStore.clear();
    settings.reset();
    setNeedsOnboarding(false);
    setGuest(true);
    setUser(GUEST_USER);
  };

  const exitGuest = () => {
    if (!guest) return;
    setNeedsOnboarding(false);
    setGuest(false);
    setUser(null);
  };

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        try {
          const { user } = await api<{ user: User }>("/api/auth/me");
          setUser(user);
          void loadSettingsFromAccount();
          void fetchProgress(true).catch(() => void 0);
        } catch {
          await clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user } = await api<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await setToken(token);
    setGuest(false);
    setUser(user);
    void loadSettingsFromAccount();
    void syncProgressAfterAuth().catch(() => void 0);
  };

  const register = async (email: string, password: string, name: string) => {
    const { token, user } = await api<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    await setToken(token);
    setNeedsOnboarding(true);
    setGuest(false);
    setUser(user);
    void syncProgressAfterAuth().catch(() => void 0);
  };

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    await clearToken();
    progressStore.clear();
    settings.reset();
    setGuest(false);
    setUser(null);
  };

  const deleteAccount = async () => {
    await api("/api/account", { method: "DELETE" });
    await clearToken();
    progressStore.clear();
    settings.reset();
    setGuest(false);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, guest, loading, needsOnboarding, finishOnboarding: () => setNeedsOnboarding(false), continueAsGuest, exitGuest, login, register, logout, deleteAccount }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
