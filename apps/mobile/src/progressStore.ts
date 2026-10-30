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
 * A value without `chessGuest` is an older plain guest copy. A value with `chessGuest: 2`
 * and no plain-object `snap` is damaged: it is removed and read as nothing, never as an
 * older plain copy. A `chessGuest` of any other value is never read (nor removed).
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
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    if (v.chessGuest === 2) {
      const snap = v.snap;
      if (snap && typeof snap === "object" && !Array.isArray(snap)) {
        return {
          snap: snap as Record<string, unknown>,
          // Fail closed: anything but exactly "guest" counts as a signed-in copy.
          origin: v.origin === "guest" ? "guest" : "signed-in",
          owner: typeof v.owner === "string" && v.owner ? v.owner : null,
        };
      }
      // A tagged copy whose snapshot is missing or not a plain object is damaged. It
      // must never be read as an older plain copy (that would merge it into whoever
      // signs in, whatever its tag said): drop it and read nothing.
      try {
        await removeGuestRaw();
      } catch {
        /* unreadable and undeletable: it is still never read */
      }
      return null;
    }
    // Some other version of the envelope: we cannot tell whose it is. Never merged.
    if ("chessGuest" in v) return null;
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
/** The saved last user id was read (or could not be): beginSession() can decide at once. */
let lastUserReady = false;
/** Read the saved last user id once, at start, before a 401 can tag a copy (see mutateProgress). */
const lastUserLoaded: Promise<void> = guestOp(async () => {
  try {
    const v = await readLastUserRaw();
    if (!lastUserTouched && typeof v === "string" && v) lastUserId = v;
  } catch {
    /* unreadable: the id stays unknown, a kept copy is then never merged */
  } finally {
    lastUserReady = true;
  }
});
/**
 * beginSession() during the cold-start read of the saved last user id is deferred until
 * the id is known, so that "did the user change?" is decided on the real previous user.
 * `sessionTurn` counts the calls (and logouts): only the latest turn applies, so a B that
 * was superseded by a C, or by a logout, never writes anything. `sessionGate` is the
 * pending application; whatever starts a pull, a sync, an edit or a read of the games
 * cache waits for it (sessionSettled) so it sees the session that is current by then.
 */
let sessionTurn = 0;
let sessionGate: Promise<void> | null = null;
async function sessionSettled(): Promise<void> {
  while (sessionGate) await sessionGate;
}
/**
 * Edits queued but not started, with their origin (was a token present when queued) and
 * the session turn they were queued in. When a session begins while the previous user is
 * still unknown, the edits queued before it with a signed-in token may be the previous
 * user's and must not run as the new one; a guest's edits (no token when queued) merge
 * as before, and so do the new user's own (queued after the call).
 */
type PendingEdit = {
  signedIn: Promise<boolean>;
  turn: number;
  cancelIfSignedIn: boolean;
};
const pendingEdits = new Set<PendingEdit>();
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

/**
 * The recent-games cache on disk, in one value, tagged like the guest copy:
 * `{ chessGames: 2, origin, owner, games }`. "signed-in" games belong to `owner` (the user
 * whose account they were pulled from or played in) and are shown only to that user.
 * "guest" games were made while signed out and are shown only to a signed-out guest.
 * A value without the tag (an older build's plain array) or a damaged one is dropped when
 * read and never shown: it may be a previous user's. clear() deletes the cache, and so
 * does beginSession() for any user who is not its owner. Its reads and writes run in one
 * queue, so a delete always lands after a write that was already started.
 */
type GamesTag = { origin: GuestOrigin; owner: string | null };
let gamesIo: Promise<void> = Promise.resolve();
function gamesOp<T>(fn: () => Promise<T>): Promise<T> {
  const p = gamesIo.then(fn, fn);
  gamesIo = p.then(
    () => undefined,
    () => undefined,
  );
  return p;
}

async function removeGamesRaw(): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(GAMES_CACHE_KEY);
  } else {
    await SecureStore.deleteItemAsync(GAMES_CACHE_KEY);
  }
}

/** The tagged cache, or null. A plain array (older build) or a damaged value is removed. Call inside gamesOp. */
async function readGamesEntry(): Promise<(GamesTag & { games: unknown[] }) | null> {
  let raw: string | null = null;
  try {
    raw = isWeb
      ? typeof localStorage !== "undefined"
        ? localStorage.getItem(GAMES_CACHE_KEY)
        : null
      : await SecureStore.getItemAsync(GAMES_CACHE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      v.chessGames === 2 &&
      Array.isArray(v.games)
    ) {
      return {
        games: v.games,
        // Fail closed: anything but exactly "guest" counts as a signed-in cache.
        origin: v.origin === "guest" ? "guest" : "signed-in",
        owner: typeof v.owner === "string" && v.owner ? v.owner : null,
      };
    }
  } catch {
    /* damaged */
  }
  try {
    await removeGamesRaw();
  } catch {
    /* it is still never shown */
  }
  return null;
}

/** Write the cache with its owner. Skipped if the session ended (generation moved) before its turn. */
function saveGamesCache(
  games: unknown[],
  tag: GamesTag,
  generation: number,
): Promise<void> {
  return gamesOp(async () => {
    if (generation !== cacheGeneration) return;
    try {
      const raw = JSON.stringify({
        chessGames: 2,
        origin: tag.origin,
        owner: tag.owner,
        games,
      });
      if (isWeb) {
        if (typeof localStorage !== "undefined")
          localStorage.setItem(GAMES_CACHE_KEY, raw);
      } else {
        await SecureStore.setItemAsync(GAMES_CACHE_KEY, raw);
      }
    } catch {
      /* ignore */
    }
  });
}

/** Logout or account deletion: nothing of the user's games stays behind. */
function dropGamesCache(): Promise<void> {
  return gamesOp(async () => {
    try {
      await removeGamesRaw();
    } catch {
      /* ignore */
    }
  });
}

/** A user signed in: keep the cache only if it is theirs. */
function dropGamesCacheUnlessOwner(userId: string): Promise<void> {
  return gamesOp(async () => {
    const entry = await readGamesEntry();
    if (entry && entry.origin === "signed-in" && entry.owner === userId) return;
    try {
      await removeGamesRaw();
    } catch {
      /* ignore */
    }
  });
}

/**
 * The owner tag of the games cache: the snapshot's (or the reply's) own user id, and null
 * when it has none. Never the last user the app knew: that may be someone else while a
 * sign-in is under way. A cache with a null owner is never shown to anyone.
 */
function currentUserId(snap: ProgressSnap): string | null {
  const id = (snap as { user?: { id?: unknown } } | null)?.user?.id;
  return typeof id === "string" && id ? id : null;
}

/**
 * The cached games for the current session, or null. A signed-out guest gets only games
 * made as a guest. A signed-in user gets only games tagged with their own id: another
 * user's, an untagged older cache and one read before the app knows who is signed in
 * give nothing. A logout or sign-in while the cache is read gives nothing.
 */
async function loadGamesCache(): Promise<unknown[] | null> {
  return (await loadGamesEntry())?.games ?? null;
}
async function loadGamesEntry(): Promise<{
  games: unknown[];
  owner: string | null;
} | null> {
  if (sessionGate) await sessionSettled();
  const generation = cacheGeneration;
  let token: string | null = null;
  try {
    token = await getToken();
  } catch {
    token = null;
  }
  await lastUserLoaded; // the saved last user id is known before it is compared
  const out = await gamesOp(async () => {
    const entry = await readGamesEntry();
    if (!entry) return null;
    if (!token)
      return entry.origin === "guest" ? { games: entry.games, owner: null } : null;
    return entry.origin === "signed-in" &&
      entry.owner !== null &&
      entry.owner === lastUserId
      ? { games: entry.games, owner: entry.owner }
      : null;
  });
  return generation === cacheGeneration ? out : null;
}

/**
 * Put the cached games of the current user into the in-memory snapshot when it has none
 * (the Shadow screen, offline or before the pull). Nothing is put there for another user:
 * the snapshot is what the next push sends, so a game that is not the user's must never
 * enter it. Returns whether it did.
 */
async function adoptCachedGames(): Promise<boolean> {
  if (sessionGate) await sessionSettled();
  const generation = cacheGeneration;
  const found = await loadGamesEntry();
  const games = found?.games;
  if (!games?.length || generation !== cacheGeneration) return false;
  if ((cache as { recentGames?: unknown } | null)?.recentGames) return false;
  // The snapshot carries the id of the cache's owner (it passed the owner check above), so
  // the next push of this user tags the games cache with it. A guest's games carry none.
  const owned =
    found?.owner && !currentUserId(cache) ? { user: { id: found.owner } } : {};
  cache = { ...(cache ?? {}), recentGames: games, ...owned };
  emit();
  return true;
}

async function pullRemote(): Promise<ProgressSnap> {
  if (sessionGate) await sessionSettled();
  const generation = cacheGeneration;
  return api<ProgressSnap>("/api/progress")
    .then(async (d) => {
      // Cleared (logout) while the GET was in flight: the reply is the old user's.
      if (generation !== cacheGeneration) return null;
      cache = d;
      lastFetchAt = Date.now();
      inflight = null;
      if (Array.isArray((d as { recentGames?: unknown[] })?.recentGames)) {
        // Owned by the account the reply came from (the server sends its id).
        await saveGamesCache(
          (d as { recentGames: unknown[] }).recentGames,
          { origin: "signed-in", owner: currentUserId(d) },
          generation,
        );
      }
      // Cleared while the games cache was being written: skip the old user's settings.
      if (generation !== cacheGeneration) return null;
      try {
        const { loadSettingsFromAccount, hydrateSettings } = await import("./settings");
        // Logged out (or another user signed in) while the module loaded: these are the
        // old user's settings.
        if (generation !== cacheGeneration) return null;
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
  if (sessionGate) await sessionSettled();
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
  if (sessionGate) await sessionSettled();
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

/** The session of `userId` begins: decide on the real previous user (see beginSession). */
function applySession(userId: string, turn: number): void {
  if (lastUserId !== null && lastUserId !== userId) {
    cacheGeneration += 1;
    inflight = null;
    cache = null;
    emit();
  } else if (lastUserId === null) {
    // The previous user is still unknown: an edit queued with a signed-in token may be
    // theirs, and is dropped (fail closed) rather than sent as this user's. Guests' edits
    // (no token when queued) are kept and merge as before.
    for (const e of pendingEdits) if (e.turn < turn) e.cancelIfSignedIn = true;
  }
  // The same user signing in again (the saved id said so) is not a change: what it
  // queued and a 401 in flight are kept. Learning a new user is (see mutateProgress).
  if (lastUserId !== userId) lastUserTouched = true;
  lastUserId = userId;
  void saveLastUser(userId);
  // The games cache stays only for its owner: a different user, or a cache nobody
  // owns (a guest's, an older build's), is deleted, also when the previous user was
  // not known yet (generation did not move).
  void dropGamesCacheUnlessOwner(userId);
}

export const progressStore = {
  get: () => cache,
  set: (d: ProgressSnap) => {
    cache = d;
    emit();
  },
  /** Explicit logout or account deletion: the old user's replies must not land. */
  clear: () => {
    sessionTurn += 1; // a beginSession() still waiting for the saved id is void now
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
    void dropGamesCache();
    emit();
  },
  /** Session expired (401): drop the cache but keep the generation, so the last edit stays as guest progress. */
  expire: () => {
    cache = null;
    emit();
  },
  /**
   * Call when a user signs in. A different user than the last one starts a new generation.
   * While the saved last user id is still being read (the first moments after a start) the
   * decision waits for it: the previous user is not known before, and deciding on "unknown"
   * is how a user B got an edit of A's. Whatever needs the session waits for it too.
   */
  beginSession: (userId: string) => {
    sessionTurn += 1;
    if (lastUserReady) {
      applySession(userId, sessionTurn);
      return;
    }
    const turn = sessionTurn;
    const gate: Promise<void> = lastUserLoaded.then(() => {
      // Superseded by a later sign-in or a logout: this one never happened.
      if (turn === sessionTurn) applySession(userId, turn);
      if (sessionGate === gate) sessionGate = null;
    });
    sessionGate = gate;
  },
  /** Resolves when every guest-copy and games-cache write or drop already queued has landed. */
  settled: async (): Promise<void> => {
    await guestIo;
    await gamesIo;
    await guestIo;
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  loadCachedGames: loadGamesCache,
  adoptCachedGames,
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
  let queuedGeneration = cacheGeneration;
  // Queued after a sign-in call that still waits for the saved id: it is that user's.
  const queuedInSession = sessionGate !== null;
  const pending: PendingEdit = {
    signedIn: getToken().then(
      (t) => Boolean(t),
      () => false,
    ),
    turn: sessionTurn,
    cancelIfSignedIn: false,
  };
  pendingEdits.add(pending);
  const run = async () => {
    // A sign-in that is waiting for the saved last user id decides first.
    if (sessionGate) await sessionSettled();
    pendingEdits.delete(pending);
    // The session it was queued in is the one that has just been decided (no later
    // sign-in or logout since): the generation that decision moved to is its own.
    if (queuedInSession && pending.turn === sessionTurn)
      queuedGeneration = cacheGeneration;
    // Queued as the old user, cleared before it got its turn: drop it.
    if (queuedGeneration !== cacheGeneration) return;
    // Queued with a signed-in token before a session began whose previous user was not
    // known: it may be that user's. Not sent as the new one's.
    if (pending.cancelIfSignedIn && (await pending.signedIn)) {
      lastWriteError = null;
      return;
    }
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
      if (Array.isArray(next.recentGames)) {
        // Tagged like the guest copy it came with (a copy kept after an expiry is
        // another user's, so its games are not a guest's either).
        const copy = await loadGuestCopy();
        await saveGamesCache(
          next.recentGames as unknown[],
          { origin: copy?.origin ?? "guest", owner: copy?.owner ?? null },
          generation,
        );
      }
      return;
    }

    // Who the request goes out for. If no user had been learned yet (the previous user
    // is unknown, or the saved id is still being read), a sign-in while it is in flight
    // flips lastUserTouched without moving the generation: the reply is then not this
    // session's. A sign-in of the same user the saved id names flips nothing.
    const sentWithUserKnown = lastUserTouched;
    const replyIsStale = () =>
      generation !== cacheGeneration || (lastUserTouched && !sentWithUserKnown);
    try {
      const ack = await api<unknown>("/api/progress", {
        method: "POST",
        body: { ...next, tz: deviceTimeZone() },
      });
      // A sign-in still waiting for the saved id decides first.
      if (sessionGate) await sessionSettled();
      // Cleared (logout, account deletion) or another user signed in while the push was
      // in flight: the reply is the old user's. Do not write it, or its games, back
      // into the cache, and do not emit.
      if (replyIsStale()) {
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
        await saveGamesCache(
          next.recentGames as unknown[],
          { origin: "signed-in", owner: currentUserId(cache) },
          generation,
        );
    } catch (e) {
      if (sessionGate) await sessionSettled();
      if (replyIsStale()) {
        lastWriteError = null;
        return;
      }
      if (e instanceof ApiError && e.status === 401) {
        // Keep the edit, marked as from a signed-in session and tagged with the user
        // whose session expired (null when unknown: it is then never merged).
        // After a restart the saved last user id may still be loading: wait for it.
        // Someone else may sign in, or log out, in that window. beginSession() starts no
        // new generation while the previous user is still unknown, so a moved generation
        // is not enough: also stop when the app learned a user meanwhile (lastUserTouched
        // flipped). Then the edit is not kept and, because the cache is set only after the
        // wait, it never reached the next user's sync either: the tag would be theirs.
        const expiredGeneration = generation;
        const knewUser = lastUserTouched;
        await lastUserLoaded;
        if (sessionGate) await sessionSettled();
        // Two arms, for two cases. A user learned during the wait (nobody was known when
        // the edit was sent) is the second arm. The generation arm covers a logout during
        // the wait when a user was already known at send time: that flips nothing for the
        // second arm. Both are pinned by tests.
        if (expiredGeneration !== cacheGeneration || (!knewUser && lastUserTouched)) {
          lastWriteError = null;
          return;
        }
        cache = next;
        lastWriteError = null;
        emit();
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
