"use client";

import { create } from "zustand";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "chessschool.install.dismissed";

function readDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(DISMISS_KEY) === "1";
}

interface PwaState {
  deferred: BeforeInstallPromptEvent | null;
  canInstall: boolean;
  installed: boolean;
  updateReady: boolean;
  dismissed: boolean;
  setDeferred: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: (v: boolean) => void;
  setUpdateReady: (v: boolean) => void;
  dismiss: () => void;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export const usePwa = create<PwaState>((set, get) => ({
  deferred: null,
  canInstall: false,
  installed: false,
  updateReady: false,
  dismissed: false,
  setDeferred: (e) => set({ deferred: e, canInstall: Boolean(e), dismissed: readDismissed() }),
  setInstalled: (v) => set({ installed: v, canInstall: false, deferred: null }),
  setUpdateReady: (v) => set({ updateReady: v }),
  dismiss: () => {
    if (typeof localStorage !== "undefined") localStorage.setItem(DISMISS_KEY, "1");
    set({ dismissed: true, canInstall: false });
  },
  promptInstall: async () => {
    const e = get().deferred;
    if (!e) return "unavailable";
    await e.prompt();
    const choice = await e.userChoice;
    if (typeof localStorage !== "undefined") localStorage.setItem(DISMISS_KEY, "1");
    set({ deferred: null, canInstall: false, dismissed: true });
    return choice.outcome;
  },
}));

export type { BeforeInstallPromptEvent };
