import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, clearToken, getToken, setUnauthorizedHandler } from "./api";
import { progressStore, fetchProgress, syncProgressAfterAuth, clearGuestProgress } from "./progressStore";
import { loadSettingsFromAccount, settings } from "./settings";
import { fetchProfile } from "./profile";
import { getOrientationSeen } from "./orientationSeen";
import { toast } from "./toast";

export type User = { id: string; name: string; email: string; role: string };

type AuthState = {
  user: User | null;
  guest: boolean;
  loading: boolean;
  orientationDone: boolean;
  needsOnboarding: boolean;
  finishOnboarding: () => void;
  markOrientationDone: () => void;
  enterGuestBrowse: () => void;
  continueAsGuest: () => void;
  exitGuest: () => void;
  login: (email: string, password: string) => Promise<void>;
  adoptSessionToken: (token: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<{ isNewUser: boolean }>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const GUEST_USER: User = { id: "guest", name: "Guest", email: "", role: "guest" };

const AuthCtx = createContext<AuthState | null>(null);

async function applyOnboardingGate(setNeedsOnboarding: (v: boolean) => void): Promise<void> {
  const profile = await fetchProfile();
  if (profile) setNeedsOnboarding(!profile.onboarded);
}

function showProgressMergedToast(): void {
  toast("Progress saved", { description: "Your guest progress is now saved to your account.", tone: "success" });
}

async function restoreGuestBrowse(
  setGuest: (v: boolean) => void,
  setUser: (v: User | null) => void,
  setNeedsOnboarding: (v: boolean) => void,
): Promise<void> {
  setNeedsOnboarding(false);
  setGuest(true);
  setUser(GUEST_USER);
  void fetchProgress(false).catch(() => void 0);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orientationDone, setOrientationDone] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const afterAuth = useCallback(async (opts?: { isNewUser?: boolean }) => {
    void loadSettingsFromAccount();
    const { merged } = await syncProgressAfterAuth().catch(() => ({ merged: false }));
    if (merged) showProgressMergedToast();
    if (opts?.isNewUser) {
      setNeedsOnboarding(true);
    } else {
      await applyOnboardingGate(setNeedsOnboarding);
    }
  }, []);

  const enterGuestBrowse = useCallback(() => {
    void restoreGuestBrowse(setGuest, setUser, setNeedsOnboarding);
  }, []);

  const markOrientationDone = useCallback(() => {
    setOrientationDone(true);
  }, []);

  // Expired session → guest academy if orientation is done, else orientation.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      progressStore.clear();
      void getOrientationSeen().then((done) => {
        if (done) void restoreGuestBrowse(setGuest, setUser, setNeedsOnboarding);
        else {
          setGuest(false);
          setUser(null);
        }
      });
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
    let cancelled = false;

    (async () => {
      const oriented = await getOrientationSeen();
      if (cancelled) return;
      setOrientationDone(oriented);

      // Resolve a saved session BEFORE seeding guest UI. Optimistic guest-first
      // raced with parity-auth adopt and could leave the suite stuck as guest.
      const t = await getToken();
      if (cancelled) return;

      if (t) {
        try {
          const { user } = await api<{ user: User }>("/api/auth/me");
          if (cancelled) return;
          setUser(user);
          setGuest(false);
          setNeedsOnboarding(false);
          setLoading(false);
          void loadSettingsFromAccount();
          void fetchProgress(true).catch(() => void 0);
          await applyOnboardingGate(setNeedsOnboarding);
          return;
        } catch {
          await clearToken();
        }
      }

      if (oriented) {
        setNeedsOnboarding(false);
        setGuest(true);
        setUser(GUEST_USER);
        setLoading(false);
        void fetchProgress(false).catch(() => void 0);
      } else {
        setGuest(false);
        setUser(null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const adoptSessionToken = async (token: string) => {
    await setToken(token);
    const { user } = await api<{ user: User }>("/api/auth/me");
    setOrientationDone(true);
    setNeedsOnboarding(false);
    setGuest(false);
    setUser(user);
    await afterAuth();
  };

  const login = async (email: string, password: string) => {
    const { token, user } = await api<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await setToken(token);
    setGuest(false);
    setUser(user);
    await afterAuth();
  };

  const loginWithGoogle = async (idToken: string) => {
    const { token, user, isNewUser } = await api<{
      token: string;
      user: User;
      isNewUser: boolean;
    }>("/api/auth/google/token", {
      method: "POST",
      body: { idToken },
    });
    await setToken(token);
    setGuest(false);
    setUser(user);
    await afterAuth({ isNewUser });
    return { isNewUser };
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
    await syncProgressAfterAuth().catch(() => void 0);
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
    const oriented = await getOrientationSeen();
    if (oriented) await restoreGuestBrowse(setGuest, setUser, setNeedsOnboarding);
    else {
      setGuest(false);
      setUser(null);
    }
  };

  const deleteAccount = async () => {
    await api("/api/account", { method: "DELETE" });
    await clearToken();
    progressStore.clear();
    settings.reset();
    const oriented = await getOrientationSeen();
    if (oriented) await restoreGuestBrowse(setGuest, setUser, setNeedsOnboarding);
    else {
      setGuest(false);
      setUser(null);
    }
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        guest,
        loading,
        orientationDone,
        needsOnboarding,
        finishOnboarding: () => setNeedsOnboarding(false),
        markOrientationDone,
        enterGuestBrowse,
        continueAsGuest,
        exitGuest,
        login,
        adoptSessionToken,
        loginWithGoogle,
        register,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
