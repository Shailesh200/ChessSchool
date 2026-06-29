import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

// Shared cached /api/progress snapshot — dedupes fetches across screens (TopBar,
// Learn, Profile, …) and is updated in-place after progression writes, so screens
// don't refetch the same data on every navigation.
export type ProgressSnap = Record<string, unknown> | null;

let cache: ProgressSnap = null;
let inflight: Promise<ProgressSnap> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export async function fetchProgress(force = false): Promise<ProgressSnap> {
  if (cache && !force) return cache;
  if (inflight) return inflight;
  inflight = api<ProgressSnap>("/api/progress")
    .then((d) => { cache = d; inflight = null; emit(); return d; })
    .catch((e) => { inflight = null; throw e; });
  return inflight;
}

export const progressStore = {
  get: () => cache,
  set: (d: ProgressSnap) => { cache = d; emit(); },
  clear: () => { cache = null; emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
};

/** Cached progress; fetches once on first use. Pass `refresh` to force a reload on mount. */
export function useProgress(refresh = false): ProgressSnap {
  const data = useSyncExternalStore(progressStore.subscribe, () => cache, () => cache);
  useEffect(() => {
    fetchProgress(refresh).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}
