import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ApiError, api, clearToken, getToken } from "./api";
import type { User } from "./auth";

/**
 * Cold-start session restore (DP-M-005).
 *
 * Only the server saying "this token is not valid" (HTTP 401) may end the session.
 * A timeout, no network, a 5xx or a malformed reply says nothing about the token, so
 * it is kept: the user boots signed in from the last user we saw for that token and
 * the session is re-checked later with `revalidateSession`.
 *
 * A 401 is handled by `api` itself (it clears the token and runs the handler set
 * with `setUnauthorizedHandler`, which is where the session-expiry wipe lives). That
 * path is the same whether the 401 arrives at boot or after an offline start.
 */

const USER_KEY = "chessschool.lastUser";
const isWeb = Platform.OS === "web";

type StoredUser = { tail: string; user: User };

/** Binds the cached user to the token it was fetched with; not a secret on its own. */
function tokenTail(token: string): string {
  return token.slice(-24);
}

async function readRaw(): Promise<string | null> {
  try {
    if (isWeb) return typeof localStorage === "undefined" ? null : localStorage.getItem(USER_KEY);
    return await SecureStore.getItemAsync(USER_KEY);
  } catch {
    return null;
  }
}

/**
 * Remember who `forToken` belongs to, so an offline cold start can open signed in.
 *
 * `forToken` is the token the caller held when it asked the server (captured BEFORE the
 * request). It is written only if that token is still the current one: a reply that lands
 * after a logout or an account switch must not tie the new token to the old user.
 */
export async function rememberUser(user: User, forToken: string): Promise<void> {
  try {
    if (!forToken || (await getToken()) !== forToken) return;
    const token = forToken;
    const raw = JSON.stringify({ tail: tokenTail(token), user } satisfies StoredUser);
    if (isWeb) {
      if (typeof localStorage !== "undefined") localStorage.setItem(USER_KEY, raw);
      return;
    }
    await SecureStore.setItemAsync(USER_KEY, raw);
  } catch {
    /* best effort */
  }
}

export async function forgetUser(): Promise<void> {
  try {
    if (isWeb) {
      if (typeof localStorage !== "undefined") localStorage.removeItem(USER_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    /* best effort */
  }
}

async function cachedUserFor(token: string): Promise<User | null> {
  const raw = await readRaw();
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredUser>;
    if (stored.tail !== tokenTail(token)) return null;
    const u = stored.user;
    if (u && typeof u.id === "string" && u.id) return u;
  } catch {
    /* corrupt entry */
  }
  return null;
}

export type BootOutcome =
  /** No saved token. */
  | { kind: "none" }
  /** /api/auth/me answered: a verified session. */
  | { kind: "online"; user: User }
  /** /api/auth/me was unreachable or failed (not 401): token kept, last-known user. */
  | { kind: "offline"; user: User }
  /** Token kept but there is no cached user for it, so this launch shows guest UI. */
  | { kind: "unverified" }
  /** The server rejected the token (401): it has been cleared. */
  | { kind: "rejected" };

/** True only for the server rejecting the credential itself. */
export function isSessionRejected(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

/** A 401 for `token`: end that session, unless the user has already moved on to another token. */
async function dropRejectedSession(token: string): Promise<void> {
  const current = await getToken();
  if (current !== null && current !== token) return; // B signed in meanwhile: keep B
  await clearToken(); // `api` already did when the token matched; idempotent
  await forgetUser();
}

export async function bootFromSavedToken(): Promise<BootOutcome> {
  const token = await getToken();
  if (!token) return { kind: "none" };
  try {
    const { user } = await api<{ user: User }>("/api/auth/me");
    await rememberUser(user, token);
    return { kind: "online", user };
  } catch (e) {
    if (isSessionRejected(e)) {
      await dropRejectedSession(token);
      return { kind: "rejected" };
    }
    const user = await cachedUserFor(token);
    return user ? { kind: "offline", user } : { kind: "unverified" };
  }
}

export type RevalidateOutcome =
  | { kind: "online"; user: User }
  /** Still cannot reach the server (or it errored): keep the session, try again later. */
  | { kind: "retry" }
  /** 401: the token is gone and the unauthorized handler has run. */
  | { kind: "rejected" }
  /** The token changed (or was cleared) while the request was out: this reply is not for the current session. */
  | { kind: "stale" };

/** Re-check a saved session that has not been confirmed by the server yet. */
export async function revalidateSession(): Promise<RevalidateOutcome> {
  const token = await getToken(); // captured BEFORE the request
  if (!token) return { kind: "stale" };
  try {
    const { user } = await api<{ user: User }>("/api/auth/me");
    if ((await getToken()) !== token) return { kind: "stale" };
    await rememberUser(user, token);
    return { kind: "online", user };
  } catch (e) {
    if (isSessionRejected(e)) {
      if ((await getToken()) !== null && (await getToken()) !== token) return { kind: "stale" };
      await dropRejectedSession(token);
      return { kind: "rejected" };
    }
    return { kind: "retry" };
  }
}
