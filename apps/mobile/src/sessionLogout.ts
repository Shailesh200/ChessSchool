import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ApiError, clearToken, getToken, revokeSessionToken } from "./api";

/**
 * Logout, local first (DP-M-006).
 *
 * The device is signed out before anything touches the network: the token is cleared,
 * the caller's local wipe runs, and only then is the server asked to revoke the token,
 * in the background. A dead or slow connection therefore cannot freeze the UI (the
 * request used to be awaited with a 45 s timeout and one retry) and cannot leave the user
 * signed in.
 *
 * A revoke that fails (offline, timeout, 5xx) is kept in `PENDING_KEY` and retried by
 * `flushPendingRevokes()` at the next app start. A 4xx (401: already invalid) ends it.
 * Concurrent calls share one run, so repeated taps cannot queue several logouts.
 */

const PENDING_KEY = "chessschool.pendingRevoke";
const MAX_PENDING = 5;
const isWeb = Platform.OS === "web";

async function readPending(): Promise<string[]> {
  try {
    const raw = isWeb
      ? typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(PENDING_KEY)
      : await SecureStore.getItemAsync(PENDING_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === "string" && t !== "") : [];
  } catch {
    return [];
  }
}

async function writePending(list: string[]): Promise<void> {
  try {
    if (list.length === 0) {
      if (isWeb) {
        if (typeof localStorage !== "undefined") localStorage.removeItem(PENDING_KEY);
      } else {
        await SecureStore.deleteItemAsync(PENDING_KEY);
      }
      return;
    }
    const raw = JSON.stringify(list);
    if (isWeb) {
      if (typeof localStorage !== "undefined") localStorage.setItem(PENDING_KEY, raw);
    } else {
      await SecureStore.setItemAsync(PENDING_KEY, raw);
    }
  } catch {
    /* best effort: the local sign-out already happened */
  }
}

/** Serialised so two settling revokes cannot overwrite each other's list. */
let pendingLock: Promise<unknown> = Promise.resolve();
function withPending<T>(fn: (list: string[]) => Promise<T>): Promise<T> {
  const run = pendingLock.then(async () => fn(await readPending()));
  pendingLock = run.catch(() => undefined);
  return run;
}

function isFinal(e: unknown): boolean {
  return e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
}

async function enqueue(token: string): Promise<void> {
  await withPending(async (list) => {
    if (list.includes(token)) return;
    await writePending([...list, token].slice(-MAX_PENDING));
  });
}

async function dequeue(token: string): Promise<void> {
  await withPending(async (list) => {
    if (list.includes(token)) await writePending(list.filter((t) => t !== token));
  });
}

/** One revoke attempt for a queued token. Never throws; a transient failure leaves it queued. */
async function revokeQueued(token: string): Promise<void> {
  try {
    await revokeSessionToken(token);
    await dequeue(token);
  } catch (e) {
    if (isFinal(e)) await dequeue(token);
  }
}

/** Retry revokes that failed earlier (call once at app start). Never throws. */
export async function flushPendingRevokes(): Promise<void> {
  const list = await withPending(async (l) => l);
  for (const token of list) await revokeQueued(token);
}

let inFlight: Promise<void> | null = null;

/**
 * Sign out on this device now, revoke on the server in the background.
 * `localWipe` is the caller's local cleanup (forget cached user, shared wipe); it runs after
 * the token is cleared and before the network is touched. Resolves when the device is
 * signed out, never when the server has answered.
 */
export function logoutOnce(localWipe: () => Promise<void>): Promise<void> {
  if (inFlight) return inFlight;
  const run = (async () => {
    const token = await getToken();
    await clearToken();
    if (token) await enqueue(token);
    try {
      await localWipe();
    } finally {
      if (token) void revokeQueued(token);
    }
  })();
  inFlight = run.finally(() => {
    inFlight = null;
  });
  return inFlight;
}
