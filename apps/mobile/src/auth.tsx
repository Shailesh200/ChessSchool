import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, clearToken, getToken } from "./api";

export type User = { id: string; name: string; email: string; role: string };

type AuthState = {
  user: User | null;
  loading: boolean;
  needsOnboarding: boolean;
  finishOnboarding: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        try {
          const { user } = await api<{ user: User }>("/api/auth/me");
          setUser(user);
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
    setUser(user);
  };

  const register = async (email: string, password: string, name: string) => {
    const { token, user } = await api<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    await setToken(token);
    setNeedsOnboarding(true);
    setUser(user);
  };

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    await clearToken();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, needsOnboarding, finishOnboarding: () => setNeedsOnboarding(false), login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
