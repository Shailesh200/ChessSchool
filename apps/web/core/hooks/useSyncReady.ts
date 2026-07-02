"use client";

import { useSyncExternalStore } from "react";

let syncReady = false;
const listeners = new Set<() => void>();

export function markSyncReady(): void {
  if (syncReady) return;
  syncReady = true;
  listeners.forEach((l) => l());
}

export function resetSyncReadyForTests(): void {
  syncReady = false;
}

/** True after initial store rehydrate + account progress pull have finished. */
export function useSyncReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => syncReady,
    () => false,
  );
}
