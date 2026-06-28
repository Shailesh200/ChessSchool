"use client";

import { create } from "zustand";

interface SessionState {
  /** null = still checking, true = logged in, false = guest */
  authed: boolean | null;
  setAuthed: (v: boolean) => void;
}

export const useSession = create<SessionState>((set) => ({
  authed: null,
  setAuthed: (v) => set({ authed: v }),
}));
