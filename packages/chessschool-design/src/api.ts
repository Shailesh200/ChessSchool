import type { Account, DailyMinutes, Prefs, Progress, Who } from "./progress";

/* ---------- wire types (shared by API, web, native) ---------- */

export type ApiProfile = { name: string; who: Who | null; dailyMinutes: DailyMinutes; appearance: Prefs["appearance"]; sound: boolean };
export type AuthResponse = { user: Account; profile: ApiProfile; progress: Progress; token: string };
export type MeResponse = { user: Account; profile: ApiProfile };
export type HomeResponse = {
  name: string;
  streak: number;
  dailyMinutes: DailyMinutes;
  xp: number;
  today: { nodeId: string; state: "current" | "done" };
  path: { id: string; state: "done" | "current" | "locked" }[];
  rooms: { id: "play" | "practice" | "club"; open: boolean }[];
};
export type GuestPayload = { guestId: string; profile?: Partial<ApiProfile>; progress?: Progress };

export type ApiErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "email_taken"
  | "google_only"
  | "google_invalid"
  | "google_unconfigured"
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "offline"
  | "server";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/* ---------- client ---------- */

export type ApiClientOptions = {
  baseUrl: string;
  /** Native passes the stored bearer token; web relies on the httpOnly cookie. */
  getToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function createApiClient({ baseUrl, getToken, fetchImpl = fetch, timeoutMs = 10_000 }: ApiClientOptions) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = getToken ? await getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        signal: ctrl.signal,
      });
    } catch {
      throw new ApiError(0, "offline");
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => null)) as { error?: ApiErrorCode; message?: string } | null;
    if (!res.ok) {
      const code = data?.error ?? (res.status >= 500 ? "server" : res.status === 401 ? "unauthorized" : "invalid_input");
      throw new ApiError(res.status, code, data?.message);
    }
    return data as T;
  }

  return {
    health: () => request<{ ok: true; version: string }>("GET", "/v1/health"),
    register: (input: { name: string; email: string; password: string; guest?: GuestPayload }) =>
      request<AuthResponse>("POST", "/v1/auth/register", input),
    login: (input: { email: string; password: string; guest?: GuestPayload }) => request<AuthResponse>("POST", "/v1/auth/login", input),
    google: (input: { idToken: string; guest?: GuestPayload }) => request<AuthResponse>("POST", "/v1/auth/google", input),
    logout: () => request<{ ok: true }>("POST", "/v1/auth/logout"),
    me: () => request<MeResponse>("GET", "/v1/me"),
    updateMe: (patch: Partial<ApiProfile>) => request<MeResponse>("PATCH", "/v1/me", patch),
    home: () => request<HomeResponse>("GET", "/v1/home"),
    putProgress: (progress: Progress) => request<{ progress: Progress }>("PUT", "/v1/progress", { progress }),
    deleteMe: () => request<{ ok: true }>("DELETE", "/v1/me"),
    feedback: (f: { mood: "love" | "ok" | "stuck"; message: string; guestId: string; context: Record<string, unknown> }) => request<{ ok: true }>("POST", "/v1/feedback", f),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;

/* ---------- validation shared by forms and the server ---------- */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const validEmail = (email: string) => EMAIL_RE.test(email.trim());
export const validPassword = (pw: string) => pw.length >= 8 && pw.length <= 200;
export const cleanName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, 40);
