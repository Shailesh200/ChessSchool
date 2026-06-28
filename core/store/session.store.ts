"use client";

import { create } from "zustand";

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

export const useSession = create<SessionState>((set) => ({
  authed: null,
  user: null,
  isAdmin: false,
  setSession: (authed, user) => set({ authed, user, isAdmin: user?.role === "admin" }),
}));
