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

// Serialized read-modify-write so concurrent writers (lesson finish, settings sync,
// match end, …) can't clobber each other: every mutation waits for the previous and
// re-reads the freshest snapshot before applying. `fn` receives the snapshot WITHOUT
// the `user` field and returns the next snapshot to POST.
let writeChain: Promise<unknown> = Promise.resolve();
export function mutateProgress(fn: (snap: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const run = async () => {
    try {
      const cur = (cache as Record<string, unknown> | null) ?? (await api<Record<string, unknown>>("/api/progress"));
      const { user: _u, ...rest } = (cur ?? {}) as { user?: unknown } & Record<string, unknown>;
      const next = fn(rest);
      await api("/api/progress", { method: "POST", body: next });
      cache = next;
      emit();
    } catch {
      /* offline / logged out — the next successful write reconciles */
    }
  };
  writeChain = writeChain.then(run, run);
  return writeChain as Promise<void>;
}

/** Cached progress; fetches once on first use. Pass `refresh` to force a reload on mount. */
export function useProgress(refresh = false): ProgressSnap {
  const data = useSyncExternalStore(progressStore.subscribe, () => cache, () => cache);
  useEffect(() => {
    fetchProgress(refresh).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}
