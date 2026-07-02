"use client";

import { useSyncExternalStore } from "react";

let rehydrateReady = false;
const listeners = new Set<() => void>();

export function markRehydrateReady(): void {
  if (rehydrateReady) return;
  rehydrateReady = true;
  listeners.forEach((l) => l());
}

export function resetRehydrateReadyForTests(): void {
  rehydrateReady = false;
}

/** True after persisted Zustand stores have loaded from localStorage. */
export function useRehydrateReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => rehydrateReady,
    () => false,
  );
}
