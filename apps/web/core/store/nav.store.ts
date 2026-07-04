"use client";

import { create } from "zustand";

interface NavState {
  loading: boolean;
  /** Bottom nav tab href being navigated to (cleared when route settles). */
  pendingTab: string | null;
  begin: (tabHref?: string) => void;
  done: () => void;
}

export const useNav = create<NavState>((set) => ({
  loading: false,
  pendingTab: null,
  begin: (tabHref) => set({ loading: true, pendingTab: tabHref ?? null }),
  done: () => set({ loading: false, pendingTab: null }),
}));

/** Call right before a programmatic router.push to show the top progress bar. */
export const startNav = () => useNav.getState().begin();
