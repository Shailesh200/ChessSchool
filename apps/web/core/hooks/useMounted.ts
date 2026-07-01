"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True only after client mount — guards persisted-store hydration mismatches.
 * Uses useSyncExternalStore so SSR/first-render returns false without a
 * setState-in-effect cascade.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}
