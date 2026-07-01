import { useEffect, useSyncExternalStore } from "react";
import { ApiError, api, getToken } from "./api";

export type ProgressSnap = Record<string, unknown> | null;

let cache: ProgressSnap = null;
let inflight: Promise<ProgressSnap> | null = null;
let lastFetchAt = 0;
let lastWriteError: string | null = null;
const PROGRESS_STALE_MS = 30_000;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export function getProgressWriteError(): string | null {
  return lastWriteError;
}

export async function fetchProgress(force = false): Promise<ProgressSnap> {
  if (!force && cache) {
    if (Date.now() - lastFetchAt > PROGRESS_STALE_MS && !inflight) {
      void fetchProgress(true).catch(() => void 0);
    }
    return cache;
  }
  if (inflight) return inflight;
  inflight = api<ProgressSnap>("/api/progress")
    .then((d) => { cache = d; lastFetchAt = Date.now(); inflight = null; emit(); return d; })
    .catch((e) => {
      inflight = null;
      if (e instanceof ApiError && e.status === 401) {
        cache = null;
        emit();
        return null;
      }
      throw e;
    });
  return inflight;
}

export const progressStore = {
  get: () => cache,
  set: (d: ProgressSnap) => { cache = d; emit(); },
  clear: () => { cache = null; emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
};

let writeChain: Promise<void> = Promise.resolve();
export function mutateProgress(fn: (snap: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const run = async () => {
    const token = await getToken();
    const base = (cache as Record<string, unknown> | null) ?? {};
    const { user: _u, ...rest } = base as { user?: unknown } & Record<string, unknown>;
    const next = fn(rest);

    if (!token) {
      cache = next;
      lastWriteError = null;
      emit();
      return;
    }

    try {
      await api("/api/progress", { method: "POST", body: next });
      cache = next;
      lastWriteError = null;
      emit();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        cache = next;
        lastWriteError = null;
        emit();
        return;
      }
      lastWriteError = e instanceof Error ? e.message : "Progress save failed";
      emit();
      throw e;
    }
  };
  writeChain = writeChain.then(run, run);
  return writeChain;
}

export function useProgress(refresh = false): ProgressSnap {
  const data = useSyncExternalStore(progressStore.subscribe, () => cache, () => cache);
  useEffect(() => {
    fetchProgress(refresh).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}
