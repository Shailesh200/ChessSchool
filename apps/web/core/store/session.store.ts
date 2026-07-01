"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface SessionUser {
  name: string;
  role: string;
}

interface SessionState {
  /** null = still checking, true = logged in, false = guest */
  authed: boolean | null;
  user: SessionUser | null;
  isAdmin: boolean;
  setSession: (authed: boolean, user: SessionUser | null) => void;
}

/**
 * Persisted so the logged-in identity survives reloads/navigations (not just the
 * in-memory check). Cleared on logout via setSession(false, null). The server
 * cookie stays the real source of truth — ProgressSync re-validates on mount.
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      authed: null,
      user: null,
      isAdmin: false,
      setSession: (authed, user) => set({ authed, user, isAdmin: user?.role === "admin" }),
    }),
    {
      name: "chessschool.session",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
