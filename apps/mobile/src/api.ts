import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Backend base URL. Defaults to production; for local verification set
 * EXPO_PUBLIC_API_URL to your Mac's LAN IP, e.g. http://192.168.1.20:3000
 * (run `pnpm --filter web dev` so the phone can reach it on the same Wi-Fi).
 */
// `||` (not `??`) so an empty EXPO_PUBLIC_API_URL falls back instead of becoming
// a relative URL (which RN can't fetch → "Network request failed").
const raw = (process.env.EXPO_PUBLIC_API_URL || "https://chess-school-alpha.vercel.app").trim().replace(/\/+$/, "");
// Tolerate a scheme-less value (e.g. "192.168.1.5:3000") by defaulting to http://.
export const API_URL = /^https?:\/\//.test(raw) ? raw : `http://${raw}`;

const TOKEN_KEY = "chessschool.token";
const isWeb = Platform.OS === "web";

// SecureStore isn't available on the web target (used for verification); fall
// back to localStorage there. Native uses the encrypted store.
export const getToken = async (): Promise<string | null> =>
  isWeb ? (typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null) : SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = async (t: string): Promise<void> => {
  if (isWeb) localStorage.setItem(TOKEN_KEY, t);
  else await SecureStore.setItemAsync(TOKEN_KEY, t);
};
export const clearToken = async (): Promise<void> => {
  if (isWeb) localStorage.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
};

/** Error carrying the HTTP status so callers can branch (e.g. 401 vs network). */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// The AuthProvider registers this so an expired session (401) can force re-auth
// from anywhere, instead of every screen silently failing its writes.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

/** Fetch helper that attaches the bearer token + JSON. Throws ApiError on non-2xx. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string };
    // A 401 with a token means the session expired → clear it and force re-auth.
    // Guests (no token) legitimately get 401s on auth-only routes; don't bounce them.
    if (res.status === 401 && token) {
      await clearToken();
      onUnauthorized?.();
    }
    throw new ApiError(res.status, msg.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
