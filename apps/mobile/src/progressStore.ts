import { Platform } from "react-native";
import { useEffect, useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { ApiError, api, getToken } from "./api";
import { adoptAckUnlessEdited } from "./progressAckGuard";
import {
  accountProgressEmpty,
  applyProgressPushAck,
  deviceTimeZone,
  localProgressPresent,
  mergeProgressSnapshots,
  normalizeProgressPush,
} from "@chess-school/progression";

export type ProgressSnap = Record<string, unknown> | null;

let cache: ProgressSnap = null;
let inflight: Promise<ProgressSnap> | null = null;
let lastFetchAt = 0;
let lastWriteError: string | null = null;
/**
 * Bumped on an explicit logout or account deletion (progressStore.clear()) and when
 * a different user signs in (progressStore.beginSession()). A push or pull notes it
 * at the start and drops its reply if it moved. A session-expiry 401
 * (progressStore.expire()) does not move it: the edit stays as guest progress.
 */
let cacheGeneration = 0;
/**
 * The last user that signed in, to tell a re-sign-in from an account switch and to tag a
 * copy kept by a 401. It is also saved (LAST_USER_KEY), so a cold-start 401 after a
 * restart still knows whose session expired: written by beginSession(), deleted by
 * clear() (an explicit logout or account deletion), read once at start.
 */
let lastUserId: string | null = null;
/** beginSession() or clear() ran: what the app knows now beats the value read from disk. */
let lastUserTouched = false;
const PROGRESS_STALE_MS = 30_000;
const GUEST_KEY = "chessschool.guestProgress";
const GAMES_CACHE_KEY = "chessschool.recentGamesCache";
const LAST_USER_KEY = "chessschool.lastUserId";
const isWeb = Platform.OS === "web";
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function snapBody(snap: Record<string, unknown>): Record<string, unknown> {
  const { user: _u, ...rest } = snap;
  return rest;
}

/**
 * The guest copy on disk, in one value so a crash cannot leave a copy without its tag:
 * `{ chessGuest: 2, origin, owner, snap }`. `origin` says where the copy came from.
 * "guest": made while signed out; it carries no owner and merges into whoever signs in.
 * "signed-in": kept when a session expired (a 401 on a push); `owner` is the user whose
 * session it was, or null when the app did not know. A copy from a signed-in session
 * merges only for its owner; with a different owner, or none, it is dropped.
 * A value without `chessGuest` is an older plain guest copy.
 * The (f)-era second key `chessschool.guestProgressOwner` is ignored: (f) never shipped
 * and lands together with (g), so no copy tagged that way exists and nothing is migrated.
 */
type GuestOrigin = "guest" | "signed-in";
type GuestCopy = {
  snap: Record<string, unknown>;
  origin: GuestOrigin;
  owner: string | null;
};
type GuestTag = { origin: GuestOrigin; owner: string | null };

async function readGuestRaw(): Promise<string | null> {
  return isWeb
    ? typeof localStorage !== "undefined"
      ? localStorage.getItem(GUEST_KEY)
      : null
    : await SecureStore.getItemAsync(GUEST_KEY);
}

async function removeGuestRaw(): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(GUEST_KEY);
  } else {
    await SecureStore.deleteItemAsync(GUEST_KEY);
  }
}

async function readGuestCopy(): Promise<GuestCopy | null> {
  try {
    const raw = await readGuestRaw();
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== "object") return null;
    if (v.chessGuest === 2 && v.snap && typeof v.snap === "object") {
      return {
        snap: v.snap as Record<string, unknown>,
        // Fail closed: anything but exactly "guest" counts as a signed-in copy.
        origin: v.origin === "guest" ? "guest" : "signed-in",
        owner: typeof v.owner === "string" && v.owner ? v.owner : null,
      };
    }
    return { snap: v, origin: "guest", owner: null };
  } catch {
    return null;
  }
}

/**
 * Every read, write and drop of the guest copy runs in this one queue, so a drop
 * (logout) always lands after a write that was already started, and a read after a drop
 * never sees the dropped copy.
 */
let guestIo: Promise<void> = Promise.resolve();
function guestOp<T>(fn: () => Promise<T>): Promise<T> {
  const p = guestIo.then(fn, fn);
  guestIo = p.then(
    () => undefined,
    () => undefined,
  );
  return p;
}

async function readLastUserRaw(): Promise<string | null> {
  return isWeb
    ? typeof localStorage !== "undefined"
      ? localStorage.getItem(LAST_USER_KEY)
      : null
    : await SecureStore.getItemAsync(LAST_USER_KEY);
}
async function writeLastUserRaw(id: string | null): Promise<void> {
  if (isWeb) {
    if (typeof localStorage === "undefined") return;
    if (id === null) localStorage.removeItem(LAST_USER_KEY);
    else localStorage.setItem(LAST_USER_KEY, id);
  } else if (id === null) {
    await SecureStore.deleteItemAsync(LAST_USER_KEY);
  } else {
    await SecureStore.setItemAsync(LAST_USER_KEY, id);
  }
}
/** Read the saved last user id once, at start, before a 401 can tag a copy (see mutateProgress). */
const lastUserLoaded: Promise<void> = guestOp(async () => {
  try {
    const v = await readLastUserRaw();
    if (!lastUserTouched && typeof v === "string" && v) lastUserId = v;
  } catch {
    /* unreadable: the id stays unknown, a kept copy is then never merged */
  }
});
const saveLastUser = (id: string | null) =>
  guestOp(() => writeLastUserRaw(id)).catch(() => undefined);

const loadGuestCopy = () => guestOp(readGuestCopy);
async function loadGuestSnap(): Promise<ProgressSnap> {
  return (await loadGuestCopy())?.snap ?? null;
}

/**
 * Save the guest copy. With a tag the copy is written with it. Without one (a guest
 * edit made while signed out) the copy keeps the tag it already had, if any.
 */
function saveGuestSnap(snap: Record<string, unknown>, tag?: GuestTag): Promise<void> {
  return guestOp(async () => {
    const t: GuestTag = tag ??
      (await readGuestCopy()) ?? { origin: "guest", owner: null };
    const raw = JSON.stringify({
      chessGuest: 2,
      origin: t.origin,
      owner: t.owner,
      snap,
    });
    if (isWeb) {
      if (typeof localStorage !== "undefined") localStorage.setItem(GUEST_KEY, raw);
      return;
    }
    await SecureStore.setItemAsync(GUEST_KEY, raw);
  });
}

/** Wipe guest-only progress (fresh guest session). */
export function clearGuestProgress(): Promise<void> {
  return guestOp(removeGuestRaw);
}

/** Explicit logout: drop a copy kept after an expiry, so nothing of the user is left behind. */
function dropKeptGuestCopy(): Promise<void> {
  return guestOp(async () => {
    const copy = await readGuestCopy();
    if (copy && copy.origin === "signed-in") await removeGuestRaw();
  });
}

export function getProgressWriteError(): string | null {
  return lastWriteError;
}

async function saveGamesCache(games: unknown[]): Promise<void> {
  try {
    const raw = JSON.stringify(games);
    if (isWeb) {
      if (typeof localStorage !== "undefined")
        localStorage.setItem(GAMES_CACHE_KEY, raw);
    } else {
      await SecureStore.setItemAsync(GAMES_CACHE_KEY, raw);
    }
  } catch {
    /* ignore */
  }
}

async function loadGamesCache(): Promise<unknown[] | null> {
  try {
    const raw = isWeb
      ? typeof localStorage !== "undefined"
        ? localStorage.getItem(GAMES_CACHE_KEY)
        : null
      : await SecureStore.getItemAsync(GAMES_CACHE_KEY);
    return raw ? (JSON.parse(raw) as unknown[]) : null;
  } catch {
    return null;
  }
}

async function pullRemote(): Promise<ProgressSnap> {
  const generation = cacheGeneration;
  return api<ProgressSnap>("/api/progress")
    .then(async (d) => {
      // Cleared (logout) while the GET was in flight: the reply is the old user's.
      if (generation !== cacheGeneration) return null;
      cache = d;
      lastFetchAt = Date.now();
      inflight = null;
      if (Array.isArray((d as { recentGames?: unknown[] })?.recentGames)) {
        await saveGamesCache((d as { recentGames: unknown[] }).recentGames);
      }
      // Cleared while the games cache was being written: skip the old user's settings.
      if (generation !== cacheGeneration) return null;
      try {
        const { loadSettingsFromAccount, hydrateSettings } = await import("./settings");
        hydrateSettings(
          (d as { settings?: Record<string, unknown> })?.settings as never,
        );
      } catch {
        /* ignore */
      }
      emit();
      return d;
    })
    .catch((e) => {
      if (generation === cacheGeneration) inflight = null;
      if (e instanceof ApiError && e.status === 401) {
        // The old user's late 401 must not wipe the next user's cache.
        if (generation !== cacheGeneration) return null;
        cache = null;
        emit();
        return null;
      }
      throw e;
    });
}

/** Pull account progress, merging any in-memory guest progress into a new account. */
export async function syncProgressAfterAuth(): Promise<{
  snap: ProgressSnap;
  merged: boolean;
}> {
  const generation = cacheGeneration;
  let local = cache ? snapBody(cache as Record<string, unknown>) : {};
  const guest = await loadGuestCopy();
  if (guest) {
    // A copy kept after a session expiry came from a signed-in session. It merges only
    // for the user whose session it was. For anyone else, or when the owner is not
    // known, it goes: from the disk and from the cache, where a guest browse may have
    // loaded it. A copy made while signed out merges into whoever signs in.
    const mine =
      guest.origin === "guest" || (guest.owner !== null && guest.owner === lastUserId);
    if (!mine) {
      await clearGuestProgress();
      if (generation === cacheGeneration) {
        local = {};
        cache = null;
        emit();
      }
    } else if (!localProgressPresent(local)) {
      Object.assign(local, snapBody(guest.snap));
    }
  }
  // Cleared (logout) or another user signed in while the copy was read: stop here.
  if (generation !== cacheGeneration) return { snap: null, merged: false };
  inflight = pullRemote();
  const server = await inflight;
  if (!server) return { snap: null, merged: false };

  const serverBody = snapBody(server as Record<string, unknown>);
  const guestHad = localProgressPresent(local);
  const accountEmpty = accountProgressEmpty(serverBody);

  if (guestHad && accountEmpty) {
    const merged = normalizeProgressPush(mergeProgressSnapshots(local, serverBody));
    try {
      const ack = await api<unknown>("/api/progress", {
        method: "POST",
        body: { ...merged, tz: deviceTimeZone() },
      });
      // Logged out while the push was in flight: the reply is the old user's.
      if (generation === cacheGeneration) {
        cache = applyProgressPushAck(
          { ...(server as Record<string, unknown>), ...merged },
          ack,
        );
        lastWriteError = null;
      }
      await clearGuestProgress();
    } catch (e) {
      if (generation === cacheGeneration) {
        cache = { ...(server as Record<string, unknown>), ...merged };
        lastWriteError = e instanceof Error ? e.message : "Progress save failed";
      }
    }
    lastFetchAt = Date.now();
    emit();
    return { snap: cache, merged: true };
  }

  cache = server;
  lastWriteError = null;
  lastFetchAt = Date.now();
  emit();
  return { snap: cache, merged: false };
}

export async function fetchProgress(force = false): Promise<ProgressSnap> {
  const token = await getToken();
  if (!token) {
    if (!cache || force) {
      const generation = cacheGeneration;
      const guest = await loadGuestSnap();
      // Cleared or switched while the copy was read: it is not for this session.
      if (generation === cacheGeneration) {
        cache = guest;
        emit();
      }
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
  set: (d: ProgressSnap) => {
    cache = d;
    emit();
  },
  /** Explicit logout or account deletion: the old user's replies must not land. */
  clear: () => {
    cacheGeneration += 1;
    inflight = null;
    // Forget the last user id, in memory and the saved one: a late 401 after this logout,
    // or after a restart, cannot tag a kept copy to the old user.
    lastUserTouched = true;
    lastUserId = null;
    void saveLastUser(null);
    cache = null;
    // Nothing of the user stays behind, not even for the same user signing back in.
    void dropKeptGuestCopy().catch(() => undefined);
    emit();
  },
  /** Session expired (401): drop the cache but keep the generation, so the last edit stays as guest progress. */
  expire: () => {
    cache = null;
    emit();
  },
  /** Call when a user signs in. A different user than the last one starts a new generation. */
  beginSession: (userId: string) => {
    if (lastUserId !== null && lastUserId !== userId) {
      cacheGeneration += 1;
      inflight = null;
      cache = null;
      emit();
    }
    lastUserTouched = true;
    lastUserId = userId;
    void saveLastUser(userId);
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  loadCachedGames: loadGamesCache,
};

/** Lesson mastery map from the cached progress snapshot. */
export function lessonRecordsFromCache(): Record<string, { mastery: number }> {
  const lessons = (cache?.lessons ?? {}) as Record<string, { mastery: number }>;
  return lessons;
}

let writeChain: Promise<void> = Promise.resolve();
export function mutateProgress(
  fn: (snap: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const queuedGeneration = cacheGeneration;
  const run = async () => {
    // Queued as the old user, cleared before it got its turn: drop it.
    if (queuedGeneration !== cacheGeneration) return;
    const generation = cacheGeneration;
    if (inflight) {
      try {
        await inflight;
      } catch {
        /* use cache or empty base */
      }
    }

    const token = await getToken();
    if (token && !cache) {
      try {
        await fetchProgress(true);
      } catch {
        /* POST with normalized empty base */
      }
    }
    if (!token && !cache) {
      const guest = await loadGuestSnap();
      // Cleared or switched while the copy was read: the copy is not for this session.
      if (generation === cacheGeneration) cache = guest;
    }

    // Cleared while waiting for the base: this edit belongs to the old user. Drop it.
    if (generation !== cacheGeneration) {
      lastWriteError = null;
      return;
    }
    const base = (cache as Record<string, unknown> | null) ?? {};
    const next = normalizeProgressPush(
      fn(snapBody(base)) as Parameters<typeof normalizeProgressPush>[0],
    );

    if (!token) {
      cache = next;
      lastWriteError = null;
      emit();
      await saveGuestSnap(next);
      if (Array.isArray(next.recentGames))
        await saveGamesCache(next.recentGames as unknown[]);
      return;
    }

    try {
      const ack = await api<unknown>("/api/progress", {
        method: "POST",
        body: { ...next, tz: deviceTimeZone() },
      });
      // Cleared (logout, account deletion) while the push was in flight: the reply
      // is the old user's. Do not write it, or its games, back into the cache.
      if (generation !== cacheGeneration) {
        lastWriteError = null;
        return;
      }
      // The store may have changed while the push was in flight. Adopt the reply
      // only for the groups the user did not touch since.
      const live = cache as Record<string, unknown> | null;
      const current = live === null || live === base ? next : live;
      const adopted = adoptAckUnlessEdited(current, next, ack);
      cache = {
        ...adopted,
        user:
          (base as { user?: unknown }).user ??
          (cache as { user?: unknown } | null)?.user,
      };
      lastWriteError = null;
      emit();
      if (Array.isArray(next.recentGames))
        await saveGamesCache(next.recentGames as unknown[]);
    } catch (e) {
      if (generation !== cacheGeneration) {
        lastWriteError = null;
        return;
      }
      if (e instanceof ApiError && e.status === 401) {
        cache = next;
        lastWriteError = null;
        emit();
        // Keep the edit, marked as from a signed-in session and tagged with the user
        // whose session expired (null when unknown: it is then never merged).
        // After a restart the saved last user id may still be loading: wait for it.
        await lastUserLoaded;
        await saveGuestSnap(next, { origin: "signed-in", owner: lastUserId });
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
  const data = useSyncExternalStore(
    progressStore.subscribe,
    () => cache,
    () => cache,
  );
  useEffect(() => {
    fetchProgress(refresh).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}
