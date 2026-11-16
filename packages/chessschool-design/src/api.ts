import type { Course, CourseLesson } from "./course";
import { copy } from "./copy";
import type { UsageBatch } from "./usage";
import type { Ratings } from "./rating";
import { language } from "./i18n";

export type RatingPoint = { at: number; rating: number };

/** `&lang=` for course words in the app language; nothing for English. */
const lang = (sep: "?" | "&") => (language() === "en" ? "" : `${sep}lang=${language()}`);
import type { Account, AvatarId, DailyMinutes, FlairId, Prefs, Progress, Streak, Who } from "./progress";

/* ---------- wire types (shared by API, web, native) ---------- */

export type ApiProfile = { name: string; who: Who | null; dailyMinutes: DailyMinutes; appearance: Prefs["appearance"]; sound: boolean; avatar: AvatarId; flair: FlairId | null };
export type ClassRole = "monitor" | "student";
/** A classmate as the class screen shows them. Stats come from their saved progress (zero for a new account). */
export type ClassMember = { id: string; name: string; role: ClassRole; avatar: AvatarId; joinedAt: number; lessons: number; xp: number; streak: Streak };
export type ReportReason = "name" | "behaviour" | "other";
export type Leaderboard = { week: { from: string; to: string }; hidden: boolean; entries: { id: string; name: string; avatar: AvatarId; lessons: number; /** XP from lessons finished this week (absent from older servers). */ xp?: number; me: boolean }[] };
/** Today's best board-vision score per game in one class (games nobody played are left out). */
export type ClassVision = { day: string; best: { game: string; score: number; id: string; name: string; avatar: AvatarId; me: boolean }[] };
/* ---------- sharing and growth (Phase 3) ---------- */
export type ShareCardKind = "game_won" | "puzzle_streak" | "rating_milestone" | "certificate" | "league_promotion" | "mate_of_the_day" | "weekly";
/** What a card may show: numbers and short course words only. */
export type ShareCardData = { fen?: string; moves?: number; streak?: number; rating?: number; unit?: string; league?: string; mate?: number; lessons?: number; puzzles?: number };
export type ShareLink = { id: string; url: string; image: string };
export type Challenge = {
  code: string;
  kind: "puzzle" | "game";
  url: string;
  /** `name` is a first name, or null for a child profile (avatar only). */
  creator: { name: string | null; avatar: AvatarId };
  expired: boolean;
  expiresAt: number;
  status: "open" | "waiting" | "active" | "over";
  you: "w" | "b" | null;
  yourTurn: boolean;
  moves: string[];
  result: string | null;
  creatorResult: "solved" | "missed" | null;
  friendResult: "solved" | "missed" | null;
  puzzle: { id: string; fen: string; moves: string[]; rating: number; themes: string[] } | null;
};
export type InviteInfo = { code: string; url: string; rewards: number; cap: number; banked: number };
export type GrowthStats = {
  day: string;
  retention: { d1: number | null; d7: number | null; d30: number | null; cohort: { d1: number; d7: number; d30: number } };
  stickiness: number | null;
  mau: number;
  daily: { day: string; installs: number }[];
  shares: number;
  sharesPerActive: number | null;
  invites: { accepted: number; rewarded: number; conversion: number | null };
  crashFree: number | null;
};

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
/** One explained moment from POST /v1/coach/explain (`tags` are @chessschool/chess mistake tags). */
export type CoachNote = { ply: number; san: string; by: "w" | "b"; verdict: "inaccuracy" | "mistake" | "blunder"; better: string | null; tags: string[]; text: string };
/** A game from Lichess, Chess.com or a pasted PGN, ready for the review screen. */
export type ImportedGame = { id: string; white: string; black: string; result: string; endedAt: number; startFen: string; moves: string[]; you: "w" | "b" | null };
export type AdminReport = { id: string; reason: ReportReason; note: string; status: "open" | "resolved"; createdAt: number; className: string | null; reported: string | null; reporter: string | null };
/** A lesson as the admin lesson editor reads and writes it (steps as the lesson runner plays them). */
export type AdminLesson = { id: string; unit: string; title: string; sub: string; minutes: number; xp: number; steps: Record<string, unknown>[] };
export type AdminCourse = {
  version: string;
  units: { id: string; title: string; sub: string; lessons: { id: string; title: string; sub: string; minutes: number; xp: number; draft: boolean }[] }[];
};
export type AdminCourseVersion = { id: string; version: string; note: string; createdBy: string; createdAt: number };
export type ClassRoom = { id: string; name: string; code: string; role: ClassRole; members: ClassMember[] };
/** Lessons the class monitor set, due on a day (YYYY-MM-DD). `done` comes from each student's saved progress. */
export type Homework = { id: string; lessons: string[]; due: string; createdAt: number; members: { id: string; name: string; avatar: AvatarId; done: boolean }[] };
export type GamePlayer = { id: string; name: string; avatar: AvatarId };
export type ClassGameResult = "1-0" | "0-1" | "1/2-1/2";
/** A rated result. `event` is the game id or a puzzle attempt id. `child` rates a child profile. */
export type RateInput = { event: string; child?: string } & (
  | { kind: "bot"; bot: string; result: "win" | "loss" | "draw"; moves: number }
  | { kind: "puzzle"; puzzle: string; puzzleRating: number; solved: boolean }
);
export type ClassGameReason = "checkmate" | "stalemate" | "draw" | "repetition" | "material" | "resign";
/** A turn-based game between two classmates. `moves` is SAN from the normal start; `you` is null for an onlooker. */
export type ClassGame = {
  id: string;
  classId: string;
  tournamentId: string | null;
  white: GamePlayer;
  black: GamePlayer;
  moves: string[];
  status: "active" | "over";
  result: ClassGameResult | null;
  reason: ClassGameReason | null;
  you: "w" | "b" | null;
  yourTurn: boolean;
  updatedAt: number;
};
/** A class round robin. Standings: 1 point a win, ½ a draw, finished games only. */
export type Tournament = { id: string; createdAt: number; done: number; total: number; standings: (GamePlayer & { points: number; played: number })[] };
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
  | "conflict"
  | "offline"
  | "server"
  | "consent_required"
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

/** GET /v1/leagues/current: guests get a sign-up card; "none" until the first XP of the week. */
export type LeagueResponse =
  | { status: "guest" | "none" }
  | { status: "joined"; league: { week: string; closesAt: number; tier: import("./leagues").LeagueTier; members: { place: number; name: string; avatar: string | null; xp: number; you: boolean; zone: import("./leagues").Zone }[]; promoted?: import("./leagues").LeagueTier } };
export type MateResponse = { day: string; today: string; puzzle: { id: string; fen: string; moves: string[] }; played: number; solved: number };

export function createApiClient({ baseUrl, getToken, fetchImpl = fetch, timeoutMs = 10_000 }: ApiClientOptions) {
  async function request<T>(method: string, path: string, body?: unknown, waitMs = timeoutMs): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = getToken ? await getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), waitMs);
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
    course: () => request<Course>("GET", `/v1/course?outline=1${lang("&")}`),
    lesson: (id: string, offline = false) => request<CourseLesson>("GET", `/v1/lessons/${encodeURIComponent(id)}?${offline ? "offline=1" : ""}${lang("&")}`),
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
    features: () => request<{ features: Record<string, boolean> }>("GET", "/v1/features"),
    league: () => request<LeagueResponse>("GET", "/v1/leagues/current"),
    mate: (day: string) => request<MateResponse>("GET", `/v1/mate/${day}`),
    mateDone: (day: string, solved: boolean) => request<{ played: number; solved: number }>("POST", `/v1/mate/${day}`, { solved }),
    putProgress: (progress: Progress) => request<{ progress: Progress }>("PUT", "/v1/progress", { progress }),
    deleteMe: () => request<{ ok: true }>("DELETE", "/v1/me"),
    feedback: (f: { mood: "love" | "ok" | "stuck"; message: string; guestId: string; context: Record<string, unknown> }) => request<{ ok: true }>("POST", "/v1/feedback", f),
    classes: () => request<{ classes: ClassRoom[] }>("GET", "/v1/classes"),
    createClass: (name: string, origin: "web" | "app" = "app") => request<{ class: ClassRoom }>("POST", "/v1/classes", { name, origin }),
    joinClass: (code: string) => request<{ class: ClassRoom }>("POST", "/v1/classes/join", { code }),
    leaveClass: (id: string) => request<{ ok: true }>("DELETE", `/v1/classes/${id}`),
    reportMember: (classId: string, memberId: string, r: { reason: ReportReason; note?: string; block: boolean }) =>
      request<{ ok: true }>("POST", `/v1/classes/${classId}/members/${memberId}/report`, r),
    leaderboard: (classId: string, day: string) => request<Leaderboard>("GET", `/v1/classes/${classId}/leaderboard?day=${day}`),
    ideas: (ids: string[]) => request<{ items: { id: string; title: string; idea: string }[] }>("GET", `/v1/ideas?ids=${ids.map(encodeURIComponent).join(",")}${lang("&")}`),
    classVision: (classId: string, day: string) => request<ClassVision>("GET", `/v1/classes/${classId}/vision?day=${day}`),
    sendVisionScore: (game: string, score: number, day: string) => request<{ ok: true }>("POST", "/v1/vision/scores", { game, score, day }),
    setLeaderboardHidden: (hidden: boolean) => request<{ hidden: boolean }>("PUT", "/v1/me/leaderboard", { hidden }),
    blockMember: (classId: string, memberId: string) => request<{ ok: true }>("POST", `/v1/classes/${classId}/members/${memberId}/block`, {}),
    removeMember: (classId: string, memberId: string) => request<{ ok: true }>("DELETE", `/v1/classes/${classId}/members/${memberId}`),
    homework: (classId: string) => request<{ homework: Homework[] }>("GET", `/v1/classes/${classId}/homework`),
    setHomework: (classId: string, h: { lessons: string[]; due: string }) => request<{ homework: Homework }>("POST", `/v1/classes/${classId}/homework`, h),
    deleteHomework: (classId: string, id: string) => request<{ ok: true }>("DELETE", `/v1/classes/${classId}/homework/${id}`),
    classGames: (classId: string) => request<{ games: ClassGame[] }>("GET", `/v1/classes/${classId}/games`),
    challenge: (classId: string, opponentId: string, color: "w" | "b" | "random") => request<{ game: ClassGame }>("POST", `/v1/classes/${classId}/games`, { opponentId, color }),
    classGame: (classId: string, id: string) => request<{ game: ClassGame }>("GET", `/v1/classes/${classId}/games/${id}`),
    playMove: (classId: string, id: string, m: { from: string; to: string; promotion?: string }) => request<{ game: ClassGame }>("POST", `/v1/classes/${classId}/games/${id}/moves`, m),
    resignGame: (classId: string, id: string) => request<{ game: ClassGame }>("POST", `/v1/classes/${classId}/games/${id}/resign`, {}),
    tournaments: (classId: string) => request<{ tournaments: Tournament[] }>("GET", `/v1/classes/${classId}/tournaments`),
    startTournament: (classId: string, players: string[]) => request<{ tournament: Tournament }>("POST", `/v1/classes/${classId}/tournaments`, { players }),
    voice: (coach: string, lesson: string) => request<{ coach: string; clips: Record<string, string> }>("GET", `/v1/voice/${coach}/${encodeURIComponent(lesson)}${lang("?")}`),
    placement: () => request<{ items: { lesson: string; step: PracticeItem["step"] }[] }>("GET", `/v1/placement${lang("?")}`),
    children: () => request<{ children: { id: string; name: string; avatar: AvatarId }[] }>("GET", "/v1/children"),
    addChild: (name: string, avatar: AvatarId) => request<{ child: { id: string; name: string; avatar: AvatarId } }>("POST", "/v1/children", { name, avatar }),
    removeChild: (id: string) => request<{ ok: true }>("DELETE", `/v1/children/${id}`),
    childProgress: (id: string) => request<{ progress: Progress }>("GET", `/v1/children/${id}/progress`),
    putChildProgress: (id: string, progress: Progress) => request<{ progress: Progress }>("PUT", `/v1/children/${id}/progress`, { progress }),
    rating: (child?: string | null) => request<{ ratings: Ratings }>("GET", `/v1/me/rating${child ? `?child=${encodeURIComponent(child)}` : ""}`),
    /** The rating after each counted result, oldest first (Profile chart). */
    ratingHistory: (child?: string | null) => request<{ points: RatingPoint[] }>("GET", `/v1/me/rating/history${child ? `?child=${encodeURIComponent(child)}` : ""}`),
    /** One finished bot game or puzzle; `event` is its id, so a retry is not counted twice. */
    rate: (input: RateInput) => request<{ ratings: Ratings; counted: boolean }>("POST", "/v1/me/rating", input),
    weekly: () => request<{ email: boolean; push: boolean }>("GET", "/v1/me/weekly"),
    setWeekly: (input: { email: boolean; pushToken?: string | null; lang: string }) => request<{ email: boolean; push: boolean }>("PUT", "/v1/me/weekly", input),
    tablebase: (fen: string) => request<{ move: string | null; category: string }>("GET", `/v1/tablebase?fen=${encodeURIComponent(fen)}`),
    explainGame: (input: { startFen: string; moves: string[]; side: "w" | "b" | null; coach: string; consent: true }) =>
      request<{ moments: CoachNote[]; provider: string | null; cached: boolean }>("POST", `/v1/coach/explain${lang("?")}`, input, 50_000),
    /** Reads a board from a downscaled photo (base64, no data: prefix). The server never stores the image. */
    scanBoard: (input: { image: string; mediaType: "image/jpeg" | "image/png" | "image/webp"; consent: true }) =>
      request<{ placement: string; fen: string; side: "w" | "b" | null; confidence: number; problem: "kings" | "pawns" | "check" | "invalid" | null }>("POST", "/v1/scan", input, 170_000),
    importGames: (source: "lichess" | "chesscom", username: string) => request<{ games: ImportedGame[] }>("POST", "/v1/import/games", { source, username }, 25_000),
    importPgn: (pgn: string) => request<{ games: ImportedGame[] }>("POST", "/v1/import/pgn", { pgn }),
    practice: (input: { lessons: string[]; review: string[]; count: number; weak?: string[] }) => request<{ items: PracticeItem[] }>("POST", `/v1/practice${lang("?")}`, input),
    /** A 7-day share link to the certificate of a finished unit (403 while unfinished). `path` is relative to the API. */
    certificateLink: (unitId: string) => request<{ url: string; path: string; unit: string }>("POST", `/v1/certificates/${encodeURIComponent(unitId)}/link${lang("?")}`, {}),
    /** Saves a share card's content; `image` is the PNG path on this API. */
    createShare: (input: { kind: ShareCardKind; data: ShareCardData; lang: string; showName?: boolean; child?: string | null; avatar?: string }) => request<ShareLink>("POST", "/v1/shares", input),
    share: (id: string) => request<{ id: string; kind: ShareCardKind; lang: string; image: string }>("GET", `/v1/shares/${encodeURIComponent(id)}`),
    createChallenge: (input: { kind: "puzzle"; puzzleId: string; solved?: boolean; child?: string | null } | { kind: "game"; child?: string | null }) => request<{ challenge: Challenge }>("POST", "/v1/challenges", input),
    friendChallenge: (code: string, seat?: string | null) => request<{ challenge: Challenge }>("GET", `/v1/challenges/${encodeURIComponent(code)}${seat ? `?seat=${encodeURIComponent(seat)}` : ""}`),
    acceptChallenge: (code: string) => request<{ seat: string; challenge: Challenge }>("POST", `/v1/challenges/${encodeURIComponent(code)}/accept`, {}),
    challengeMove: (code: string, move: { from: string; to: string; promotion?: string; seat?: string | null }) => request<{ challenge: Challenge }>("POST", `/v1/challenges/${encodeURIComponent(code)}/moves`, move),
    challengeResult: (code: string, solved: boolean) => request<{ challenge: Challenge }>("POST", `/v1/challenges/${encodeURIComponent(code)}/result`, { solved }),
    myInvite: () => request<InviteInfo>("GET", "/v1/invites/mine"),
    invite: (code: string) => request<{ code: string; name: string | null }>("GET", `/v1/invites/${encodeURIComponent(code)}`),
    acceptInvite: (code: string) => request<{ ok: true; accepted: boolean }>("POST", "/v1/invites/accept", { code }),
    /** Moves banked invite freezes into the streak; `have` is how many the streak holds now. */
    claimFreezes: (have: number) => request<{ freezes: number; banked: number }>("POST", "/v1/invites/claim", { have }),
    adminGrowth: () => request<GrowthStats>("GET", "/v1/admin/growth"),
    sendUsage: (batch: UsageBatch) => request<{ ok: true; stored: number }>("POST", "/v1/events", batch),
    adminUsage: (days: number) => request<UsageSummary>("GET", `/v1/admin/usage?days=${days}`),
    adminReports: () => request<{ reports: AdminReport[] }>("GET", "/v1/admin/reports"),
    resolveReport: (id: string, status: "open" | "resolved") => request<{ ok: true }>("PATCH", `/v1/admin/reports/${id}`, { status }),
    adminCourse: () => request<AdminCourse>("GET", "/v1/admin/course"),
    adminLesson: (id: string) =>
      request<{ lesson: AdminLesson; draft: { lesson: AdminLesson; updatedBy: string; updatedAt: number } | null }>("GET", `/v1/admin/course/lessons/${encodeURIComponent(id)}`),
    validateLesson: (lesson: unknown) => request<{ ok: boolean; errors: string[] }>("POST", "/v1/admin/course/validate", { lesson }),
    saveLessonDraft: (id: string, lesson: unknown) => request<{ ok: true }>("PUT", `/v1/admin/course/drafts/${encodeURIComponent(id)}`, { lesson }),
    /** Writes a new lesson for this slot with the language model and saves it as the draft (never live). */
    draftLessonWithAi: (id: string, brief: { topic: string; level: "beginner" | "intermediate" | "advanced" }) =>
      request<{ lesson: AdminLesson; errors: string[]; attempts: number }>("POST", `/v1/admin/course/lessons/${encodeURIComponent(id)}/ai-draft`, brief, 180_000),
    discardLessonDraft: (id: string) => request<{ ok: true }>("DELETE", `/v1/admin/course/drafts/${encodeURIComponent(id)}`),
    publishLesson: (lesson: unknown) => request<{ ok: true; version: string }>("POST", "/v1/admin/course/publish", { lesson }),
    courseVersions: () => request<{ versions: AdminCourseVersion[] }>("GET", "/v1/admin/course/versions"),
    rollbackCourse: (id: string) => request<{ ok: true; version: string }>("POST", `/v1/admin/course/versions/${encodeURIComponent(id)}/rollback`),
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
