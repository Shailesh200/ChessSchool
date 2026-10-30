import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, clearToken, setUnauthorizedHandler } from "./api";
import { progressStore, fetchProgress, syncProgressAfterAuth, clearGuestProgress } from "./progressStore";
import { loadSettingsFromAccount } from "./settings";
import { wipeUserData } from "./wipeUserData";
import { fetchProfile } from "./profile";
import { getOrientationSeen } from "./orientationSeen";
import { toast } from "./toast";
import { logoutOnce, flushPendingRevokes } from "./sessionLogout";
import { bootFromSavedToken, forgetUser, rememberUser, revalidateSession } from "./authBoot";

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
  /** Booted from the cached user because /api/auth/me was unreachable. */
  const [needsRevalidate, setNeedsRevalidate] = useState(false);

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
      // Session expired: the same wipe as a logout, except the in-flight edit stays as
      // guest progress (no new generation): wipeUserData({ expired }) calls expire().
      void wipeUserData({ expired: true });
      setNeedsRevalidate(false);
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

  /** Browse as guest without wiping local progress (matches web “Continue as guest”). */
  const continueAsGuest = () => {
    void clearToken();
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
      // Only a 401 ends the session; offline / timeout / 5xx keep the token (DP-M-005).
      void flushPendingRevokes(); // revokes that failed while offline at an earlier logout
      const outcome = await bootFromSavedToken();
      if (cancelled) return;

      if (outcome.kind === "online") {
        const { user } = outcome;
        progressStore.beginSession(user.id);
        setUser(user);
        setGuest(false);
        setNeedsOnboarding(false);
        setLoading(false);
        void loadSettingsFromAccount();
        void fetchProgress(true).catch(() => void 0);
        await applyOnboardingGate(setNeedsOnboarding);
        return;
      }

      if (outcome.kind === "offline") {
        // Signed in from the last known user; /me is re-checked in the background.
        const { user: cachedUser } = outcome;
        progressStore.beginSession(cachedUser.id);
        setUser(cachedUser);
        setGuest(false);
        setNeedsOnboarding(false);
        setLoading(false);
        setNeedsRevalidate(true);
        void loadSettingsFromAccount();
        void fetchProgress(true).catch(() => void 0);
        return;
      }

      // A saved token with no cached user (first launch after update, offline): the
      // guest UI below is only a placeholder until /api/auth/me answers.
      if (outcome.kind === "unverified") setNeedsRevalidate(true);

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

  // Offline cold start: re-check /api/auth/me until the server answers. A 401 clears
  // the token and runs the unauthorized handler (the session-expiry path) inside api().
  useEffect(() => {
    if (!needsRevalidate) return;
    let stopped = false;
    const tick = async () => {
      const r = await revalidateSession();
      if (stopped || r.kind === "retry") return;
      if (r.kind === "stale") {
        // The session changed under this check (logout / another sign-in): drop it, change nothing.
        stopped = true;
        clearInterval(timer);
        setNeedsRevalidate(false);
        return;
      }
      stopped = true;
      clearInterval(timer);
      setNeedsRevalidate(false);
      if (r.kind === "online") {
        // The full sign-in path, as at an online boot (also leaves guest mode).
        progressStore.beginSession(r.user.id);
        setUser(r.user);
        setGuest(false);
        setNeedsOnboarding(false);
        setLoading(false);
        void loadSettingsFromAccount();
        void fetchProgress(true).catch(() => void 0);
        await applyOnboardingGate(setNeedsOnboarding);
      }
    };
    const timer = setInterval(() => void tick(), 30_000);
    void tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [needsRevalidate]);

  const adoptSessionToken = async (token: string) => {
    await setToken(token);
    const { user } = await api<{ user: User }>("/api/auth/me");
    void rememberUser(user, token);
    progressStore.beginSession(user.id);
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
    await rememberUser(user, token);
    progressStore.beginSession(user.id);
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
    await rememberUser(user, token);
    progressStore.beginSession(user.id);
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
    await rememberUser(user, token);
    progressStore.beginSession(user.id);
    setNeedsOnboarding(true);
    setGuest(false);
    setUser(user);
    await syncProgressAfterAuth().catch(() => void 0);
  };

  const logout = async () => {
    setNeedsRevalidate(false);
    // Local first (DP-M-006): the token goes and the wipe runs now; the server revoke is fired
    // in the background (queued for the next start if it fails), so a dead network can neither
    // freeze this button nor keep the user signed in.
    await logoutOnce(async () => {
      void forgetUser();
      await wipeUserData();
    });
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
    void forgetUser();
    setNeedsRevalidate(false);
    await wipeUserData();
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
