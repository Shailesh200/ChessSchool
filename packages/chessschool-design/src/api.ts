import type { Course, CourseLesson } from "./course";
import { copy } from "./copy";
import type { UsageBatch } from "./usage";
import type { Account, AvatarId, DailyMinutes, FlairId, Prefs, Progress, Streak, Who } from "./progress";

/* ---------- wire types (shared by API, web, native) ---------- */

export type ApiProfile = { name: string; who: Who | null; dailyMinutes: DailyMinutes; appearance: Prefs["appearance"]; sound: boolean; avatar: AvatarId; flair: FlairId | null };
export type ClassRole = "monitor" | "student";
/** A classmate as the class screen shows them. Stats come from their saved progress (zero for a new account). */
export type ClassMember = { id: string; name: string; role: ClassRole; avatar: AvatarId; joinedAt: number; lessons: number; xp: number; streak: Streak };
export type ReportReason = "name" | "behaviour" | "other";
export type UsageSummary = {
  days: number;
  installs: number;
  daily: { day: string; installs: number }[];
  lessons: { lesson: string; starts: number; finishes: number; quits: number; completion: number; topQuitStep: number | null }[];
  puzzles: { solved: number; failed: number };
  games: number;
  platforms: { platform: string; installs: number }[];
};
/** One practice position; `step` is a lesson step as the lesson runner plays it. */
export type PracticeItem = { ref: string; step: Record<string, unknown> & { kind: string } };
export type AdminReport = { id: string; reason: ReportReason; note: string; status: "open" | "resolved"; createdAt: number; className: string | null; reported: string | null; reporter: string | null };
export type ClassRoom = { id: string; name: string; code: string; role: ClassRole; members: ClassMember[] };
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

/** Body for `POST /v1/auth/apple`. `nonce` is the raw nonce; Apple receives its sha256 hex. `guest` is the same device payload as Google, login and register. */
export type AppleSignInBody = {
  identityToken: string;
  nonce?: string;
  fullName?: { givenName?: string; familyName?: string };
  email?: string;
  guest?: GuestPayload;
};

export type ApiErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "email_taken"
  | "email_in_use"
  | "google_only"
  | "google_invalid"
  | "google_unconfigured"
  | "apple_invalid"
  | "apple_unconfigured"
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "forbidden"
  | "offline"
  | "server"
  | "GUEST_CLASS_LIMIT";

/** 403 `{ error: "GUEST_CLASS_LIMIT" }` from a lesson fetch or a progress save. */
export function isGuestClassLimit(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.code === "GUEST_CLASS_LIMIT";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const authErrorCopy: Partial<Record<ApiErrorCode, string>> = {
  invalid_credentials: copy.auth.errors.credentials,
  email_taken: copy.auth.errors.emailTaken,
  email_in_use: copy.auth.emailInUse,
  google_only: copy.auth.errors.googleOnly,
  google_invalid: copy.auth.errors.generic,
  google_unconfigured: copy.auth.googleUnavailable,
  apple_invalid: copy.auth.appleInvalid,
  apple_unconfigured: copy.auth.appleUnconfigured,
  rate_limited: copy.auth.errors.rateLimited,
  offline: copy.auth.errors.offline,
};

/** Friendly text for a failed auth call. A 409 email_in_use is not an offline error. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return copy.auth.errors.generic;
  return authErrorCopy[err.code] ?? (err.status >= 500 || err.status === 0 ? copy.auth.errors.offline : copy.auth.errors.generic);
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
    course: () => request<Course>("GET", "/v1/course?outline=1"),
    lesson: (id: string) => request<CourseLesson>("GET", `/v1/lessons/${encodeURIComponent(id)}`),
    register: (input: { name: string; email: string; password: string; guest?: GuestPayload }) =>
      request<AuthResponse>("POST", "/v1/auth/register", input),
    login: (input: { email: string; password: string; guest?: GuestPayload }) => request<AuthResponse>("POST", "/v1/auth/login", input),
    google: (input: { idToken: string; guest?: GuestPayload }) => request<AuthResponse>("POST", "/v1/auth/google", input),
    /** Same session shape as `google`. Path sits beside `/v1/auth/google`. */
    apple: (input: AppleSignInBody) => request<AuthResponse>("POST", "/v1/auth/apple", input),
    logout: () => request<{ ok: true }>("POST", "/v1/auth/logout"),
    me: () => request<MeResponse>("GET", "/v1/me"),
    updateMe: (patch: Partial<ApiProfile>) => request<MeResponse>("PATCH", "/v1/me", patch),
    home: () => request<HomeResponse>("GET", "/v1/home"),
    putProgress: (progress: Progress) => request<{ progress: Progress }>("PUT", "/v1/progress", { progress }),
    deleteMe: () => request<{ ok: true }>("DELETE", "/v1/me"),
    feedback: (f: { mood: "love" | "ok" | "stuck"; message: string; guestId: string; context: Record<string, unknown> }) => request<{ ok: true }>("POST", "/v1/feedback", f),
    classes: () => request<{ classes: ClassRoom[] }>("GET", "/v1/classes"),
    createClass: (name: string, origin: "web" | "app" = "app") => request<{ class: ClassRoom }>("POST", "/v1/classes", { name, origin }),
    joinClass: (code: string) => request<{ class: ClassRoom }>("POST", "/v1/classes/join", { code }),
    leaveClass: (id: string) => request<{ ok: true }>("DELETE", `/v1/classes/${id}`),
    reportMember: (classId: string, memberId: string, r: { reason: ReportReason; note?: string; block: boolean }) =>
      request<{ ok: true }>("POST", `/v1/classes/${classId}/members/${memberId}/report`, r),
    blockMember: (classId: string, memberId: string) => request<{ ok: true }>("POST", `/v1/classes/${classId}/members/${memberId}/block`, {}),
    removeMember: (classId: string, memberId: string) => request<{ ok: true }>("DELETE", `/v1/classes/${classId}/members/${memberId}`),
    voice: (coach: string, lesson: string) => request<{ coach: string; clips: Record<string, string> }>("GET", `/v1/voice/${coach}/${encodeURIComponent(lesson)}`),
    practice: (input: { lessons: string[]; review: string[]; count: number }) => request<{ items: PracticeItem[] }>("POST", "/v1/practice", input),
    sendUsage: (batch: UsageBatch) => request<{ ok: true; stored: number }>("POST", "/v1/events", batch),
    adminUsage: (days: number) => request<UsageSummary>("GET", `/v1/admin/usage?days=${days}`),
    adminReports: () => request<{ reports: AdminReport[] }>("GET", "/v1/admin/reports"),
    resolveReport: (id: string, status: "open" | "resolved") => request<{ ok: true }>("PATCH", `/v1/admin/reports/${id}`, { status }),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;

/* ---------- validation shared by forms and the server ---------- */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const validEmail = (email: string) => EMAIL_RE.test(email.trim());
export const validPassword = (pw: string) => pw.length >= 8 && pw.length <= 200;
export const cleanName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, 40);

/** True when `latest` is a higher dotted version than `current` (1.2.0 > 1.1.9). */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d > 0) return true;
    if (d < 0) return false;
  }
  return false;
}
