import { Platform } from "react-native";
import { useEffect, useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { ApiError, api, getToken } from "./api";
import {
  accountProgressEmpty,
  localProgressPresent,
  mergeProgressSnapshots,
  normalizeProgressPush,
} from "@chess-school/progression";

export type ProgressSnap = Record<string, unknown> | null;

let cache: ProgressSnap = null;
let inflight: Promise<ProgressSnap> | null = null;
let lastFetchAt = 0;
let lastWriteError: string | null = null;
const PROGRESS_STALE_MS = 30_000;
const GUEST_KEY = "chessschool.guestProgress";
const isWeb = Platform.OS === "web";
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

function snapBody(snap: Record<string, unknown>): Record<string, unknown> {
  const { user: _u, ...rest } = snap;
  return rest;
}

async function loadGuestSnap(): Promise<ProgressSnap> {
  try {
    const raw = isWeb
      ? typeof localStorage !== "undefined"
        ? localStorage.getItem(GUEST_KEY)
        : null
      : await SecureStore.getItemAsync(GUEST_KEY);
    return raw ? (JSON.parse(raw) as ProgressSnap) : null;
  } catch {
    return null;
  }
}

async function saveGuestSnap(snap: Record<string, unknown>): Promise<void> {
  const raw = JSON.stringify(snap);
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.setItem(GUEST_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(GUEST_KEY, raw);
}

/** Wipe guest-only progress (fresh guest session). */
export async function clearGuestProgress(): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(GUEST_KEY);
  } else {
    await SecureStore.deleteItemAsync(GUEST_KEY);
  }
}

export function getProgressWriteError(): string | null {
  return lastWriteError;
}

async function pullRemote(): Promise<ProgressSnap> {
  return api<ProgressSnap>("/api/progress")
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
}

/** Pull account progress, merging any in-memory guest progress into a new account. */
export async function syncProgressAfterAuth(): Promise<ProgressSnap> {
  const local = cache ? snapBody(cache as Record<string, unknown>) : {};
  if (!localProgressPresent(local)) {
    const guest = await loadGuestSnap();
    if (guest) Object.assign(local, snapBody(guest as Record<string, unknown>));
  }
  inflight = pullRemote();
  const server = await inflight;
  if (!server) return null;

  const serverBody = snapBody(server as Record<string, unknown>);
  const guestHad = localProgressPresent(local);
  const accountEmpty = accountProgressEmpty(serverBody);

  if (guestHad && accountEmpty) {
    const merged = normalizeProgressPush(mergeProgressSnapshots(local, serverBody));
    try {
      await api("/api/progress", { method: "POST", body: merged });
      cache = { ...(server as Record<string, unknown>), ...merged };
      lastWriteError = null;
      await clearGuestProgress();
    } catch (e) {
      cache = { ...(server as Record<string, unknown>), ...merged };
      lastWriteError = e instanceof Error ? e.message : "Progress save failed";
    }
  } else {
    cache = server;
    lastWriteError = null;
  }
  lastFetchAt = Date.now();
  emit();
  return cache;
}

export async function fetchProgress(force = false): Promise<ProgressSnap> {
  const token = await getToken();
  if (!token) {
    if (!cache || force) {
      cache = await loadGuestSnap();
      emit();
    }
    return cache;
  }

  if (!force && cache) {
    if (Date.now() - lastFetchAt > PROGRESS_STALE_MS && !inflight) {
      void fetchProgress(true).catch(() => void 0);
    }
    return cache;
  }
  if (inflight) return inflight;
  inflight = pullRemote();
  return inflight;
}

export const progressStore = {
  get: () => cache,
  set: (d: ProgressSnap) => { cache = d; emit(); },
  clear: () => { cache = null; emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
};

/** Lesson mastery map from the cached progress snapshot. */
export function lessonRecordsFromCache(): Record<string, { mastery: number }> {
  const lessons = (cache?.lessons ?? {}) as Record<string, { mastery: number }>;
  return lessons;
}

let writeChain: Promise<void> = Promise.resolve();
export function mutateProgress(fn: (snap: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const run = async () => {
    if (inflight) {
      try { await inflight; } catch { /* use cache or empty base */ }
    }

    const token = await getToken();
    if (token && !cache) {
      try { await fetchProgress(true); } catch { /* POST with normalized empty base */ }
    }
    if (!token && !cache) {
      cache = await loadGuestSnap();
    }

    const base = (cache as Record<string, unknown> | null) ?? {};
    const next = normalizeProgressPush(fn(snapBody(base)) as Parameters<typeof normalizeProgressPush>[0]);

    if (!token) {
      cache = next;
      lastWriteError = null;
      emit();
      await saveGuestSnap(next);
      return;
    }

    try {
      await api("/api/progress", { method: "POST", body: next });
      cache = { ...next, user: (base as { user?: unknown }).user ?? (cache as { user?: unknown } | null)?.user };
      lastWriteError = null;
      emit();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        cache = next;
        lastWriteError = null;
        emit();
        await saveGuestSnap(next);
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
