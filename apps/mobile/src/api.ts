import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const PRODUCTION = "https://chess-school-alpha.vercel.app";

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(normalizeUrl(url)).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Metro host IP — on a physical device this is your Mac's LAN address. */
function metroDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    Constants.experienceUrl?.replace(/^https?:\/\//, "");
  if (!hostUri) return null;
  const host = hostUri.split(":")[0]?.split("/")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (__DEV__) {
    const lanHost = metroDevHost();
    // Physical device: localhost in .env points at the phone — use Metro's LAN IP instead.
    if (lanHost && (!envUrl || isLocalHost(envUrl))) {
      return `http://${lanHost}:3000`;
    }
    if (envUrl) return normalizeUrl(envUrl);
    return "http://localhost:3000";
  }

  if (envUrl) return normalizeUrl(envUrl);
  return PRODUCTION;
}

/**
 * Backend base URL. In dev on a physical device, auto-uses your Mac's LAN IP
 * (same host Metro uses) so login/progress sync works without editing .env.
 */
export const API_URL = resolveApiUrl();

const TOKEN_KEY = "chessschool.token";
const REQUEST_TIMEOUT_MS = 15_000;
const isWeb = Platform.OS === "web";

function requestSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

async function fetchOnce<T>(path: string, opts: { method?: string; body?: unknown; token: string | null }): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: requestSignal(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 401 && opts.token) {
      await clearToken();
      onUnauthorized?.();
    }
    throw new ApiError(res.status, msg.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Fetch helper with bearer token, 15s timeout, and one retry on network failure. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  try {
    return await fetchOnce<T>(path, { ...opts, token });
  } catch (e) {
    const retryable = e instanceof TypeError || (e instanceof Error && e.name === "TimeoutError");
    if (!retryable) throw e;
    return fetchOnce<T>(path, { ...opts, token });
  }
}
