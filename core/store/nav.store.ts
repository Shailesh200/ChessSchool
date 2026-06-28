"use client";

import { create } from "zustand";

interface NavState {
  loading: boolean;
  begin: () => void;
  done: () => void;
}

export const useNav = create<NavState>((set) => ({
  loading: false,
  begin: () => set({ loading: true }),
  done: () => set({ loading: false }),
}));

/** Call right before a programmatic router.push to show the top progress bar. */
export const startNav = () => useNav.getState().begin();
