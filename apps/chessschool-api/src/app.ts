import {
  cleanName,
  dayKey,
  emptyProgress,
  isAvatarId,
  isCoachId,
  isLang,
  isSkillId,
  isFlairId,
  isProgress,
  mergeProgress,
  sanitizeProgress,
  validEmail,
  validPassword,
  visibleStreak,
  type Account,
  type ApiErrorCode,
  type ApiProfile,
  type ClassGame,
  type ClassGameReason,
  type ClassGameResult,
  type ClassRoom,
  type GamePlayer,
  type Homework,
  type Tournament,
  type AuthResponse,
  type DailyMinutes,
  type GuestPayload,
  type Lang,
  type HomeResponse,
  type Progress,
} from "@chessschool/design";
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { isVisionGame, isVisionScore, VISION_GAMES } from "@chessschool/chess";
import { alias } from "drizzle-orm/sqlite-core";
import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { deleteUserData } from "./account-delete";
import { certificateSvg, certToken, DEV_CERT_SECRET, readCertToken } from "./certificate";
import { courseAccess, guestProgressOverreach, GUEST_CLASS_LIMIT, GUEST_LIMIT_CODE, isGuestAccount, type CourseAccess } from "./access";
import { loadIdeas, loadLesson, loadLessonSteps, loadLessonsWithSteps, loadOutline, loadPath, type PathEntry } from "./course";
import { checkLessonEdit, deleteDraft, loadCourseDoc, loadDrafts, loadVersion, listVersions, publishCourse, saveDraft } from "./course-admin";
import { checkCourse } from "./course-check";
import { MAX_PRACTICE, pickPractice } from "./practice";
import type { AiProvider } from "./ai";
import { explainGame, parseCoachInput } from "./coach";
import { chesscomGames, gameFromPgn, isUsername, lichessGames, PGN_MAX_BYTES, webFetch, type ImportFetch } from "./game-import";
import { lessonClips } from "./voice";
import { bestEndgameMove, lichessTablebase, tablebaseKey, type TablebaseFetch } from "./tablebase";
import { EMAIL_RUN_CAP, summarize, summaryMessage, type Sender } from "./weekly";
import { loadCourseText, localizeNamed, localizeSteps, type CourseText } from "./course-text";
import { loadPuzzle, loadPuzzlePack, PUZZLE_CACHE } from "./puzzles";
import type { AppleVerifier } from "./apple";
import type { Db } from "./db";
import type { GoogleVerifier } from "./google";
import { blocks, childProgress, children, classes, classGames, classMembers, courseUnits, feedback, homework, leaderboardHidden, profiles, progress, reports, sessions, tournaments, users, visionScores, weeklySummary } from "./schema";
import { playMove, roundRobin, splitMoves, standings } from "./class-play";
import { parseEvents, recordEvents, usageSummary } from "./usage";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  checkPassword,
  createRateLimiter,
  hashPassword,
  hashToken,
  newId,
  newToken,
} from "./security";

export const API_VERSION = "0.4.0";
/** Store version learners should be on. Bump when a new Play / TestFlight build is the one to install. */
export const LATEST_APP = "0.4.0";

export type AppDeps = {
  db: Db;
  google: GoogleVerifier | null;
  /** Null when APPLE_CLIENT_IDS is unset. Sign in with Apple then returns 503. */
  apple?: AppleVerifier | null;
  secureCookies: boolean;
  corsOrigins: string[];
  now?: () => Date;
  /** Lower-case emails allowed to read the usage dashboard and the report queue. */
  adminEmails?: string[];
  /** Weekly parent summary delivery (Resend + Expo push in production). */
  weekly?: Sender;
  /** Vercel Cron's bearer secret; without it the cron route is off. */
  cronSecret?: string;
  /** Endgame tablebase lookup (Lichess by default; tests pass a fake). */
  tablebase?: TablebaseFetch;
  /** Language-model chain for the game coach (empty: the coach answers 503). Tests pass a fake. */
  coachAi?: AiProvider[];
  /** Lichess / Chess.com fetches for game import (tests pass a fake). */
  importFetch?: ImportFetch;
  /** Crash reporting hook (Sentry in production). Gets the error only, never the request body. */
  reportError?: (err: unknown) => Promise<void> | void;
  /** HMAC key for shareable certificate links (CERT_SECRET). Without it, a dev key is used unless cookies are secure (production). */
  certSecret?: string;
};

const REPORT_REASONS = ["name", "behaviour", "other"] as const;
/** Hindi lines are recorded in this one coach voice, used whichever coach the learner picked. */
const HINDI_VOICE = "meera";
/** Eight lessons of rising difficulty for the placement quiz (units 1, 2, 3, 5, 7, 12, 14, 18). */
const PLACEMENT_LESSONS = ["check", "forks", "ladder", "skewer", "backRank", "squareOfPawn", "deflection", "calculation"] as const;

/** Escapes text placed into the HTML of /join pages (class names are typed by users). */
const html = (v: string) => v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

type UserRow = typeof users.$inferSelect;
type Vars = { Variables: { user: UserRow } };

/** A member's saved progress for the class card; anything unreadable counts as a fresh start. */
function memberProgress(data: string | null): Progress {
  if (!data) return emptyProgress();
  try {
    const p = JSON.parse(data) as unknown;
    return isProgress(p) ? p : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

const fail = (c: Context, status: number, error: ApiErrorCode, message?: string) =>
  c.json({ error, message }, status as 400);

const WHO = new Set(["me", "child", "class"]);
const MINUTES = new Set([5, 10, 15]);
const APPEARANCE = new Set(["system", "light", "dark"]);

export function createApp({ db, google, apple = null, secureCookies, corsOrigins, now = () => new Date(), adminEmails = [], reportError, tablebase = lichessTablebase, weekly, cronSecret, certSecret, coachAi = [], importFetch = webFetch }: AppDeps) {
  const app = new Hono<Vars>();
  const certKey = certSecret || (secureCookies ? null : DEV_CERT_SECRET);
  const authLimiter = createRateLimiter(12, 60_000, () => now().getTime());
  const tablebaseLimiter = createRateLimiter(60, 60_000, () => now().getTime());
  const feedbackLimiter = createRateLimiter(5, 10 * 60_000, () => now().getTime());
  const eventsLimiter = createRateLimiter(30, 60_000, () => now().getTime());
  const reportLimiter = createRateLimiter(10, 60 * 60_000, () => now().getTime());
  /** Homework, challenges and tournaments; moves and resigns have their own, roomier limit. */
  const classWriteLimiter = createRateLimiter(30, 10 * 60_000, () => now().getTime());
  const moveLimiter = createRateLimiter(120, 60_000, () => now().getTime());
  /** Each explanation runs the engine over the whole game, so even cache hits are limited. */
  const coachLimiter = createRateLimiter(6, 60_000, () => now().getTime());
  const importLimiter = createRateLimiter(10, 10 * 60_000, () => now().getTime());
  const admins = new Set(adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean));


  app.use("/v1/*", cors({ origin: corsOrigins, credentials: true, allowHeaders: ["Content-Type", "Authorization", "If-None-Match"], exposeHeaders: ["ETag"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));

  app.onError(async (err, c) => {
    console.error(err);
    await reportError?.(err);
    return fail(c, 500, "server");
  });
  app.notFound((c) => fail(c, 404, "not_found"));

  /* ---------- helpers ---------- */

  const toAccount = (u: UserRow): Account => ({
    id: u.id,
    email: u.email,
    name: u.name,
    provider: (u.passwordHash ? "password" : u.appleSub && !u.googleSub ? "apple" : "google") as Account["provider"],
  });

  async function loadProfile(userId: string): Promise<ApiProfile> {
    const row = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
    return {
      name: "",
      who: (row?.who as ApiProfile["who"]) ?? null,
      dailyMinutes: ((row?.dailyMinutes ?? 10) as DailyMinutes),
      appearance: (row?.appearance as ApiProfile["appearance"]) ?? "system",
      sound: row?.sound ?? true,
      avatar: isAvatarId(row?.avatar) ? row.avatar : "cody",
      flair: isFlairId(row?.flair) ? row.flair : null,
    };
  }

  /** The lesson order from the course tables. Empty only before a course has been seeded. */
  const coursePath = () => loadPath(db);

  /** With no course seeded, stored progress is returned unchecked so it is never trimmed. */
  async function loadProgress(userId: string, path?: PathEntry[]): Promise<Progress> {
    const [row, lessons] = await Promise.all([db.query.progress.findFirst({ where: eq(progress.userId, userId) }), path ?? coursePath()]);
    if (!row) return emptyProgress();
    try {
      const parsed = JSON.parse(row.data);
      if (!isProgress(parsed)) return emptyProgress();
      return lessons.length ? sanitizeProgress(parsed, lessons) : parsed;
    } catch {
      return emptyProgress();
    }
  }

  async function saveProgress(userId: string, p: Progress) {
    const data = JSON.stringify(p);
    const t = now().getTime();
    await db.insert(progress).values({ userId, data, updatedAt: t }).onConflictDoUpdate({ target: progress.userId, set: { data, updatedAt: t } });
  }

  async function mergeGuestInto(user: UserRow, guest: GuestPayload | undefined): Promise<Progress> {
    const path = await coursePath();
    const current = await loadProgress(user.id, path);
    if (!guest?.progress || !isProgress(guest.progress) || !path.length) return current;
    const merged = sanitizeProgress(mergeProgress(current, sanitizeProgress(guest.progress, path)), path);
    await saveProgress(user.id, merged);
    return merged;
  }

  async function startSession(c: Context, user: UserRow): Promise<string> {
    const token = newToken();
    const t = now().getTime();
    await db.insert(sessions).values({ tokenHash: hashToken(token), userId: user.id, createdAt: t, expiresAt: t + SESSION_DAYS * 86_400_000 });
    await db.delete(sessions).where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, t)));
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: "Lax", secure: secureCookies, path: "/", maxAge: SESSION_DAYS * 86_400 });
    return token;
  }

  async function authResponse(c: Context, user: UserRow, guest?: GuestPayload): Promise<AuthResponse> {
    const prog = await mergeGuestInto(user, guest);
    const token = await startSession(c, user);
    const profile = await loadProfile(user.id);
    return { user: toAccount(user), profile: { ...profile, name: user.name }, progress: prog, token };
  }

  function readToken(c: Context): string | null {
    const h = c.req.header("Authorization");
    if (h?.startsWith("Bearer ")) return h.slice(7).trim() || null;
    return getCookie(c, SESSION_COOKIE) ?? null;
  }

  async function userFromRequest(c: Context): Promise<UserRow | null> {
    const token = readToken(c);
    if (!token) return null;
    const row = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now().getTime())))
      .get();
    return row?.user ?? null;
  }

  const requireUser = async (c: Context<Vars>, next: () => Promise<void>) => {
    const user = await userFromRequest(c);
    if (!user) return fail(c, 401, "unauthorized");
    c.set("user", user);
    await next();
  };

  const limitAuth = async (c: Context, next: () => Promise<void>) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
    if (!authLimiter(`${ip}:${c.req.path}`)) return fail(c, 429, "rate_limited");
    await next();
  };

  async function body<T>(c: Context): Promise<Partial<T>> {
    try {
      const b = await c.req.json();
      return b && typeof b === "object" ? (b as Partial<T>) : {};
    } catch {
      return {};
    }
  }

  function guestOf(b: { guest?: unknown }): GuestPayload | undefined {
    const g = b.guest as GuestPayload | undefined;
    return g && typeof g === "object" && typeof g.guestId === "string" ? g : undefined;
  }

  async function applyGuestProfile(userId: string, guest: GuestPayload | undefined, overwrite: boolean) {
    const gp = guest?.profile ?? {};
    const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
    if (existing && !overwrite) return;
    const values = {
      userId,
      who: typeof gp.who === "string" && WHO.has(gp.who) ? gp.who : (existing?.who ?? null),
      dailyMinutes: MINUTES.has(gp.dailyMinutes as number) ? (gp.dailyMinutes as number) : (existing?.dailyMinutes ?? 10),
      appearance: APPEARANCE.has(gp.appearance as string) ? (gp.appearance as string) : (existing?.appearance ?? "system"),
      sound: typeof gp.sound === "boolean" ? gp.sound : (existing?.sound ?? true),
      avatar: isAvatarId(gp.avatar) ? gp.avatar : isAvatarId(existing?.avatar) ? existing.avatar : "cody",
      flair: gp.flair === null ? null : isFlairId(gp.flair) ? gp.flair : isFlairId(existing?.flair) ? existing.flair : null,
    };
    await db.insert(profiles).values(values).onConflictDoUpdate({ target: profiles.userId, set: values });
  }

  /* ---------- routes ---------- */

  const health = (c: Context) => c.json({ ok: true, version: API_VERSION, app: LATEST_APP, time: now().toISOString() });
  app.get("/health", health);
  app.get("/v1/health", health);

  app.post("/v1/auth/register", limitAuth, async (c) => {
    const b = await body<{ name: string; email: string; password: string; guest: GuestPayload }>(c);
    const name = cleanName(String(b.name ?? ""));
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!name || !validEmail(email) || !validPassword(password)) return fail(c, 400, "invalid_input");
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) return fail(c, 409, "email_taken");
    const guest = guestOf(b);
    const user: UserRow = { id: newId(), email, name, passwordHash: await hashPassword(password), googleSub: null, appleSub: null, guestId: guest?.guestId ?? null, kind: "member", createdAt: now().getTime() };
    await db.insert(users).values(user);
    await applyGuestProfile(user.id, guest, true);
    return c.json(await authResponse(c, user, guest), 201);
  });

  app.post("/v1/auth/login", limitAuth, async (c) => {
    const b = await body<{ email: string; password: string; guest: GuestPayload }>(c);
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!validEmail(email) || !password) return fail(c, 400, "invalid_input");
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (user && !user.passwordHash) return fail(c, 401, "google_only");
    if (!user || !(await checkPassword(password, user.passwordHash!))) return fail(c, 401, "invalid_credentials");
    await applyGuestProfile(user.id, guestOf(b), false);
    return c.json(await authResponse(c, user, guestOf(b)));
  });

  app.post("/v1/auth/google", limitAuth, async (c) => {
    if (!google) return fail(c, 503, "google_unconfigured");
    const b = await body<{ idToken: string; guest: GuestPayload }>(c);
    const identity = typeof b.idToken === "string" ? await google(b.idToken) : null;
    if (!identity) return fail(c, 401, "google_invalid");
    const guest = guestOf(b);
    let user = await db.query.users.findFirst({ where: eq(users.googleSub, identity.sub) });
    if (!user) {
      const byEmail = await db.query.users.findFirst({ where: eq(users.email, identity.email) });
      if (byEmail) return c.json({ error: "email_in_use" }, 409);
      const guestName = cleanName(String(guest?.profile?.name ?? ""));
      user = { id: newId(), email: identity.email, name: guestName || cleanName(identity.name) || "", passwordHash: null, googleSub: identity.sub, appleSub: null, guestId: guest?.guestId ?? null, kind: "member", createdAt: now().getTime() };
      await db.insert(users).values(user);
      await applyGuestProfile(user.id, guest, true);
    }
    return c.json(await authResponse(c, user, guest));
  });

  const appleName = (fullName: unknown) => {
    if (!fullName || typeof fullName !== "object") return "";
    const name = fullName as { givenName?: unknown; familyName?: unknown };
    const given = typeof name.givenName === "string" ? name.givenName : "";
    const family = typeof name.familyName === "string" ? name.familyName : "";
    return cleanName(`${given} ${family}`);
  };

  app.post("/v1/auth/apple", limitAuth, async (c) => {
    if (!apple) return c.json({ error: "apple_unconfigured" }, 503);
    const b = await body<{ identityToken: string; nonce?: string; fullName?: { givenName?: string; familyName?: string }; email?: string; guest: GuestPayload }>(c);
    if (typeof b.nonce !== "string" || b.nonce.length === 0) return c.json({ error: "apple_invalid" }, 401);
    const identity = typeof b.identityToken === "string" ? await apple(b.identityToken, b.nonce) : null;
    if (!identity) return c.json({ error: "apple_invalid" }, 401);
    const guest = guestOf(b);
    let user = await db.query.users.findFirst({ where: eq(users.appleSub, identity.sub) });
    if (!user) {
      if (!identity.email) return c.json({ error: "apple_invalid" }, 401);
      const byEmail = await db.query.users.findFirst({ where: eq(users.email, identity.email) });
      if (byEmail) return c.json({ error: "email_in_use" }, 409);
      {
        const guestName = cleanName(String(guest?.profile?.name ?? ""));
        user = {
          id: newId(),
          email: identity.email,
          name: guestName || appleName(b.fullName),
          passwordHash: null,
          googleSub: null,
          appleSub: identity.sub,
          guestId: guest?.guestId ?? null,
          kind: "member",
          createdAt: now().getTime(),
        };
        await db.insert(users).values(user);
        await applyGuestProfile(user.id, guest, true);
      }
    }
    return c.json(await authResponse(c, user, guest));
  });

  app.post("/v1/auth/logout", async (c) => {
    const token = readToken(c);
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  /** Permanently deletes the account and everything stored for it on this server. */
  app.delete("/v1/me", requireUser, async (c) => {
    const user = c.get("user");
    await deleteUserData(db, user.id);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  /** In-app feedback. Works for guests; rate limited per address. */
  app.post("/v1/feedback", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
    if (!feedbackLimiter(ip)) return fail(c, 429, "rate_limited");
    const b = await body<{ mood: string; message: string; guestId: string; context: Record<string, unknown> }>(c);
    const message = typeof b.message === "string" ? b.message.trim().slice(0, 2000) : "";
    if (message.length < 3 || !["love", "ok", "stuck"].includes(b.mood ?? "")) return fail(c, 400, "invalid_input");
    const user = await userFromRequest(c);
    const context = JSON.stringify(b.context && typeof b.context === "object" ? b.context : {}).slice(0, 2000);
    await db.insert(feedback).values({
      id: crypto.randomUUID(),
      userId: user?.id ?? null,
      guestId: typeof b.guestId === "string" ? b.guestId.slice(0, 64) : null,
      mood: b.mood!,
      message,
      context,
      createdAt: now().getTime(),
    });
    return c.json({ ok: true });
  });

  app.get("/v1/me", requireUser, async (c) => {
    const user = c.get("user");
    return c.json({ user: toAccount(user), profile: { ...(await loadProfile(user.id)), name: user.name } });
  });

  app.patch("/v1/me", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<ApiProfile>(c);
    if (b.name !== undefined) {
      const name = cleanName(String(b.name));
      if (!name) return fail(c, 400, "invalid_input");
      await db.update(users).set({ name }).where(eq(users.id, user.id));
      user.name = name;
    }
    if (b.who !== undefined && b.who !== null && !WHO.has(b.who)) return fail(c, 400, "invalid_input");
    if (b.dailyMinutes !== undefined && !MINUTES.has(b.dailyMinutes)) return fail(c, 400, "invalid_input");
    if (b.appearance !== undefined && !APPEARANCE.has(b.appearance)) return fail(c, 400, "invalid_input");
    if (b.sound !== undefined && typeof b.sound !== "boolean") return fail(c, 400, "invalid_input");
    if (b.avatar !== undefined && !isAvatarId(b.avatar)) return fail(c, 400, "invalid_input");
    if (b.flair !== undefined && b.flair !== null && !isFlairId(b.flair)) return fail(c, 400, "invalid_input");
    await applyGuestProfile(user.id, { guestId: "patch", profile: b }, true);
    return c.json({ user: toAccount(user), profile: { ...(await loadProfile(user.id)), name: user.name } });
  });

  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const classCode = () => {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  };

  async function roomOf(classId: string, viewerId: string): Promise<ClassRoom | null> {
    const row = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!row) return null;
    const members = await db
      .select({ id: users.id, name: users.name, role: classMembers.role, joinedAt: classMembers.joinedAt, avatar: profiles.avatar, data: progress.data })
      .from(classMembers)
      .innerJoin(users, eq(users.id, classMembers.userId))
      .leftJoin(profiles, eq(profiles.userId, classMembers.userId))
      .leftJoin(progress, eq(progress.userId, classMembers.userId))
      .where(eq(classMembers.classId, classId));
    const me = members.find((m) => m.id === viewerId);
    if (!me) return null;
    const hidden = new Set((await db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, viewerId))).map((b) => b.id));
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      role: me.role === "monitor" ? "monitor" : "student",
      members: members
        .filter((m) => !hidden.has(m.id))
        .map((m) => {
          const p = memberProgress(m.data);
          const placed = new Set(p.placed);
          return {
            id: m.id,
            name: m.name || "Friend",
            role: m.role === "monitor" ? "monitor" : "student",
            avatar: isAvatarId(m.avatar) ? m.avatar : "cody",
            joinedAt: m.joinedAt,
            lessons: Object.keys(p.completed).filter((id) => !placed.has(id)).length,
            xp: p.xp,
            streak: p.streak,
          };
        }),
    };
  }

  app.get("/v1/join/:code", async (c) => {
    const code = c.req.param("code").trim().toUpperCase();
    const row = await db.query.classes.findFirst({ where: eq(classes.code, code) });
    if (!row) return fail(c, 404, "not_found");
    return c.json({ name: row.name, code: row.code, origin: row.origin === "web" ? "web" : "app" });
  });

  app.get("/join/:code", async (c) => {
    const code = c.req.param("code").trim().toUpperCase();
    const row = await db.query.classes.findFirst({ where: eq(classes.code, code) });
    if (!row) return c.html("<p>That class code does not match.</p>", 404);
    const origin = row.origin === "web" ? "web" : "app";
    const name = html(row.name);
    return c.html(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><p>Join ${name}. Code ${html(code)}.</p><script>
      var code=${JSON.stringify(code)};
      var origin=${JSON.stringify(origin)};
      location.href="chessschool://join/"+code;
      setTimeout(function(){
        if (document.hidden || origin==="web") return;
        var ua=navigator.userAgent;
        if (/android/i.test(ua)) location.replace("https://play.google.com/store/apps/details?id=com.chessschool.app");
        else if (/iphone|ipad/i.test(ua)) location.replace("https://apps.apple.com/app/id6828715695");
      }, 1200);
    </script>`);
  });

  app.get("/v1/classes", requireUser, async (c) => {
    const user = c.get("user");
    const mine = await db.select({ classId: classMembers.classId }).from(classMembers).where(eq(classMembers.userId, user.id));
    const rooms = (await Promise.all(mine.map((m) => roomOf(m.classId, user.id)))).filter((r): r is ClassRoom => Boolean(r));
    return c.json({ classes: rooms });
  });

  app.post("/v1/classes", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<{ name?: string; origin?: string }>(c);
    const name = cleanName(String(b.name ?? ""));
    if (!name) return fail(c, 400, "invalid_input");
    const origin = b.origin === "web" ? "web" : "app";
    let code = classCode();
    for (let i = 0; i < 4; i++) {
      const clash = await db.query.classes.findFirst({ where: eq(classes.code, code) });
      if (!clash) break;
      code = classCode();
    }
    const id = newId();
    const at = now().getTime();
    await db.insert(classes).values({ id, name, code, ownerId: user.id, createdAt: at, origin });
    await db.insert(classMembers).values({ classId: id, userId: user.id, role: "monitor", joinedAt: at });
    return c.json({ class: await roomOf(id, user.id) }, 201);
  });

  app.post("/v1/classes/join", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<{ code?: string }>(c);
    const code = String(b.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return fail(c, 400, "invalid_input");
    const row = await db.query.classes.findFirst({ where: eq(classes.code, code) });
    if (!row) return fail(c, 404, "not_found");
    const already = await db.query.classMembers.findFirst({ where: and(eq(classMembers.classId, row.id), eq(classMembers.userId, user.id)) });
    if (!already) await db.insert(classMembers).values({ classId: row.id, userId: user.id, role: "student", joinedAt: now().getTime() });
    return c.json({ class: await roomOf(row.id, user.id) });
  });

  app.delete("/v1/classes/:id", requireUser, async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!id) return fail(c, 400, "invalid_input");
    const row = await db.query.classes.findFirst({ where: eq(classes.id, id) });
    if (!row) return fail(c, 404, "not_found");
    const mine = await db.query.classMembers.findFirst({ where: and(eq(classMembers.classId, id), eq(classMembers.userId, user.id)) });
    if (!mine) return fail(c, 404, "not_found");
    if (row.ownerId === user.id)
      await db.batch([
        db.delete(classGames).where(eq(classGames.classId, id)),
        db.delete(homework).where(eq(homework.classId, id)),
        db.delete(tournaments).where(eq(tournaments.classId, id)),
        db.delete(classes).where(eq(classes.id, id)),
      ]);
    else await db.delete(classMembers).where(and(eq(classMembers.classId, id), eq(classMembers.userId, user.id)));
    return c.json({ ok: true });
  });

  /** The caller and the target share this class; returns both rows, or a failure response. */
  async function memberPair(c: Context, classId: string, memberId: string, viewerId: string) {
    const [room, viewer, target] = await Promise.all([
      db.query.classes.findFirst({ where: eq(classes.id, classId) }),
      db.query.classMembers.findFirst({ where: and(eq(classMembers.classId, classId), eq(classMembers.userId, viewerId)) }),
      db.query.classMembers.findFirst({ where: and(eq(classMembers.classId, classId), eq(classMembers.userId, memberId)) }),
    ]);
    if (!room || !viewer || !target) return { error: fail(c, 404, "not_found") };
    if (memberId === viewerId) return { error: fail(c, 400, "invalid_input") };
    return { room, viewer, target };
  }

  /**
   * This week's lessons per classmate, for the class leaderboard. `day` is the caller's local date;
   * the week runs Monday to Sunday around it. Hidden learners and blocked classmates are left out.
   */
  app.get("/v1/classes/:id/leaderboard", requireUser, async (c) => {
    const user = c.get("user");
    const qDay = c.req.query("day");
    const today = qDay && /^\d{4}-\d{2}-\d{2}$/.test(qDay) ? qDay : dayKey(now());
    const room = await roomOf(c.req.param("id") ?? "", user.id);
    if (!room) return fail(c, 404, "not_found");
    const [hiddenRows, mine] = await Promise.all([db.select().from(leaderboardHidden), db.query.leaderboardHidden.findFirst({ where: eq(leaderboardHidden.userId, user.id) })]);
    const hidden = new Set(hiddenRows.map((h) => h.userId));
    const d = new Date(`${today}T12:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    const sunday = new Date(new Date(`${monday}T12:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
    const rows = await db.select({ id: progress.userId, data: progress.data }).from(progress).where(inArray(progress.userId, room.members.map((m) => m.id)));
    const week = new Map(
      rows.map((r) => {
        const p = memberProgress(r.data);
        const placed = new Set(p.placed);
        return [r.id, Object.entries(p.completed).filter(([id, day]) => !placed.has(id) && day >= monday && day <= sunday).length];
      }),
    );
    const entries = room.members
      .filter((m) => !hidden.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, lessons: week.get(m.id) ?? 0, me: m.id === user.id }))
      .sort((a, b) => b.lessons - a.lessons || a.name.localeCompare(b.name));
    return c.json({ week: { from: monday, to: sunday }, hidden: Boolean(mine), entries });
  });

  /** Records a board-vision run; the day keeps the learner's best per game. */
  app.post("/v1/vision/scores", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<{ game: unknown; score: unknown; day: unknown }>(c);
    if (!isVisionGame(b.game) || !isVisionScore(b.score) || typeof b.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.day)) return fail(c, 400, "invalid_input");
    await db
      .insert(visionScores)
      .values({ userId: user.id, game: b.game, day: b.day, score: b.score })
      .onConflictDoUpdate({ target: [visionScores.userId, visionScores.game, visionScores.day], set: { score: sql`max(${visionScores.score}, excluded.score)` } });
    return c.json({ ok: true });
  });

  /** Today's best board-vision score per game in one class. Hidden learners and blocked classmates are left out. */
  app.get("/v1/classes/:id/vision", requireUser, async (c) => {
    const user = c.get("user");
    const qDay = c.req.query("day");
    const day = qDay && /^\d{4}-\d{2}-\d{2}$/.test(qDay) ? qDay : dayKey(now());
    const room = await roomOf(c.req.param("id") ?? "", user.id);
    if (!room) return fail(c, 404, "not_found");
    const hidden = new Set((await db.select().from(leaderboardHidden)).map((h) => h.userId));
    const members = new Map(room.members.filter((m) => !hidden.has(m.id)).map((m) => [m.id, m]));
    const rows = members.size ? await db.select().from(visionScores).where(and(eq(visionScores.day, day), inArray(visionScores.userId, [...members.keys()]))) : [];
    const best = VISION_GAMES.flatMap((game) => {
      const top = rows.filter((r) => r.game === game && r.score > 0).sort((a, b) => b.score - a.score || members.get(a.userId)!.name.localeCompare(members.get(b.userId)!.name))[0];
      const m = top && members.get(top.userId)!;
      return m ? [{ game, score: top.score, id: m.id, name: m.name, avatar: m.avatar, me: m.id === user.id }] : [];
    });
    return c.json({ day, best });
  });

  /** Show or hide yourself on every class leaderboard. */
  app.put("/v1/me/leaderboard", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<{ hidden?: unknown }>(c);
    if (typeof b.hidden !== "boolean") return fail(c, 400, "invalid_input");
    if (b.hidden) await db.insert(leaderboardHidden).values({ userId: user.id }).onConflictDoNothing();
    else await db.delete(leaderboardHidden).where(eq(leaderboardHidden.userId, user.id));
    return c.json({ hidden: b.hidden });
  });

  /** Report a classmate. It goes to the admin queue; unless `block: false`, the reporter also stops seeing them. */
  app.post("/v1/classes/:id/members/:memberId/report", requireUser, async (c) => {
    const user = c.get("user");
    if (!reportLimiter(user.id)) return fail(c, 429, "rate_limited");
    const b = await body<{ reason?: string; note?: string; block?: boolean }>(c);
    const reason = (REPORT_REASONS as readonly string[]).includes(b.reason ?? "") ? b.reason! : null;
    if (!reason) return fail(c, 400, "invalid_input");
    const pair = await memberPair(c, c.req.param("id") ?? "", c.req.param("memberId") ?? "", user.id);
    if ("error" in pair) return pair.error;
    const at = now().getTime();
    const report = db.insert(reports).values({ id: newId(), classId: pair.room.id, reporterId: user.id, reportedId: pair.target.userId, reason, note: String(b.note ?? "").trim().slice(0, 500), status: "open", createdAt: at });
    if (b.block === false) await report;
    else await db.batch([report, db.insert(blocks).values({ blockerId: user.id, blockedId: pair.target.userId, createdAt: at }).onConflictDoNothing()]);
    return c.json({ ok: true });
  });

  /** Stop seeing a classmate in any class. */
  app.post("/v1/classes/:id/members/:memberId/block", requireUser, async (c) => {
    const user = c.get("user");
    const pair = await memberPair(c, c.req.param("id") ?? "", c.req.param("memberId") ?? "", user.id);
    if ("error" in pair) return pair.error;
    await db.insert(blocks).values({ blockerId: user.id, blockedId: pair.target.userId, createdAt: now().getTime() }).onConflictDoNothing();
    return c.json({ ok: true });
  });

  /** The class monitor removes a member. */
  app.delete("/v1/classes/:id/members/:memberId", requireUser, async (c) => {
    const user = c.get("user");
    const pair = await memberPair(c, c.req.param("id") ?? "", c.req.param("memberId") ?? "", user.id);
    if ("error" in pair) return pair.error;
    if (pair.room.ownerId !== user.id) return fail(c, 403, "forbidden");
    await db.delete(classMembers).where(and(eq(classMembers.classId, pair.room.id), eq(classMembers.userId, pair.target.userId)));
    return c.json({ ok: true });
  });

  /* ---------- class homework, games and tournaments ---------- */

  /** True when either user has blocked the other. */
  async function blockedBetween(a: string, b: string) {
    const row = await db.query.blocks.findFirst({ where: or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))) });
    return Boolean(row);
  }

  async function players(ids: string[]): Promise<Map<string, GamePlayer>> {
    if (!ids.length) return new Map();
    const rows = await db
      .select({ id: users.id, name: users.name, avatar: profiles.avatar })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(inArray(users.id, [...new Set(ids)]));
    return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name || "Friend", avatar: isAvatarId(r.avatar) ? r.avatar : "cody" }]));
  }

  type GameRow = typeof classGames.$inferSelect;
  function gameView(g: GameRow, viewerId: string, people: Map<string, GamePlayer>): ClassGame {
    const moves = splitMoves(g.moves);
    const you = g.whiteId === viewerId ? "w" : g.blackId === viewerId ? "b" : null;
    const who = (id: string): GamePlayer => people.get(id) ?? { id, name: "Friend", avatar: "cody" };
    return {
      id: g.id,
      classId: g.classId,
      tournamentId: g.tournamentId,
      white: who(g.whiteId),
      black: who(g.blackId),
      moves,
      status: g.status === "over" ? "over" : "active",
      result: (g.result as ClassGameResult | null) ?? null,
      reason: (g.reason as ClassGameReason | null) ?? null,
      you,
      yourTurn: g.status !== "over" && you === (moves.length % 2 ? "b" : "w"),
      updatedAt: g.updatedAt,
    };
  }
  const oneGame = async (g: GameRow, viewerId: string) => gameView(g, viewerId, await players([g.whiteId, g.blackId]));

  /** The class's homework, soonest due first, with which students have finished every lesson. */
  async function homeworkOf(room: ClassRoom, only?: string): Promise<Homework[]> {
    const rows = await db.select().from(homework).where(only ? and(eq(homework.classId, room.id), eq(homework.id, only)) : eq(homework.classId, room.id)).orderBy(asc(homework.due), asc(homework.createdAt));
    const students = room.members.filter((m) => m.role === "student").sort((a, b) => a.name.localeCompare(b.name));
    const saved = students.length ? await db.select({ id: progress.userId, data: progress.data }).from(progress).where(inArray(progress.userId, students.map((m) => m.id))) : [];
    const finished = new Map(
      saved.map((r) => {
        const p = memberProgress(r.data);
        const placed = new Set(p.placed);
        return [r.id, new Set(Object.keys(p.completed).filter((id) => !placed.has(id)))];
      }),
    );
    return rows.map((h) => {
      const lessons = JSON.parse(h.lessons) as string[];
      return {
        id: h.id,
        lessons,
        due: h.due,
        createdAt: h.createdAt,
        members: students.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, done: lessons.every((l) => finished.get(m.id)?.has(l)) })),
      };
    });
  }

  app.get("/v1/classes/:id/homework", requireUser, async (c) => {
    const room = await roomOf(c.req.param("id") ?? "", c.get("user").id);
    if (!room) return fail(c, 404, "not_found");
    return c.json({ homework: await homeworkOf(room) });
  });

  app.post("/v1/classes/:id/homework", requireUser, async (c) => {
    const user = c.get("user");
    const room = await roomOf(c.req.param("id") ?? "", user.id);
    if (!room) return fail(c, 404, "not_found");
    if (room.role !== "monitor") return fail(c, 403, "forbidden");
    if (!classWriteLimiter(user.id)) return fail(c, 429, "rate_limited");
    const b = await body<{ lessons: unknown; due: unknown }>(c);
    const known = new Set((await loadPath(db)).map((p) => p.id));
    const lessons = Array.isArray(b.lessons) ? [...new Set(b.lessons)] : [];
    const due = typeof b.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due) && !Number.isNaN(Date.parse(b.due)) ? b.due : null;
    if (!due || !lessons.length || lessons.length > 10 || !lessons.every((l) => typeof l === "string" && known.has(l))) return fail(c, 400, "invalid_input");
    const id = newId();
    await db.insert(homework).values({ id, classId: room.id, createdBy: user.id, lessons: JSON.stringify(lessons), due, createdAt: now().getTime() });
    return c.json({ homework: (await homeworkOf(room, id))[0] }, 201);
  });

  app.delete("/v1/classes/:id/homework/:homeworkId", requireUser, async (c) => {
    const room = await roomOf(c.req.param("id") ?? "", c.get("user").id);
    if (!room) return fail(c, 404, "not_found");
    if (room.role !== "monitor") return fail(c, 403, "forbidden");
    const gone = await db.delete(homework).where(and(eq(homework.classId, room.id), eq(homework.id, c.req.param("homeworkId") ?? "")));
    if (!gone.rowsAffected) return fail(c, 404, "not_found");
    return c.json({ ok: true });
  });

  /** My games in this class: my turn first, then the most recently played. */
  app.get("/v1/classes/:id/games", requireUser, async (c) => {
    const user = c.get("user");
    const room = await roomOf(c.req.param("id") ?? "", user.id);
    if (!room) return fail(c, 404, "not_found");
    const rows = await db
      .select()
      .from(classGames)
      .where(and(eq(classGames.classId, room.id), or(eq(classGames.whiteId, user.id), eq(classGames.blackId, user.id))))
      .orderBy(desc(classGames.updatedAt));
    const people = await players(rows.flatMap((g) => [g.whiteId, g.blackId]));
    const games = rows.map((g) => gameView(g, user.id, people));
    return c.json({ games: [...games.filter((g) => g.yourTurn), ...games.filter((g) => !g.yourTurn)] });
  });

  /** Challenge a classmate. Blocked pairs (either way) cannot play. */
  app.post("/v1/classes/:id/games", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<{ opponentId: string; color: string }>(c);
    const pair = await memberPair(c, c.req.param("id") ?? "", String(b.opponentId ?? ""), user.id);
    if ("error" in pair) return pair.error;
    if (await blockedBetween(user.id, pair.target.userId)) return fail(c, 403, "forbidden");
    if (!classWriteLimiter(user.id)) return fail(c, 429, "rate_limited");
    const color = b.color === "w" || b.color === "b" ? b.color : Math.random() < 0.5 ? "w" : "b";
    const at = now().getTime();
    const row: GameRow = {
      id: newId(),
      classId: pair.room.id,
      tournamentId: null,
      whiteId: color === "w" ? user.id : pair.target.userId,
      blackId: color === "w" ? pair.target.userId : user.id,
      moves: "",
      status: "active",
      result: null,
      reason: null,
      createdAt: at,
      updatedAt: at,
    };
    await db.insert(classGames).values(row);
    return c.json({ game: await oneGame(row, user.id) }, 201);
  });

  /** A game in a class the caller belongs to. */
  async function classGame(c: Context, userId: string) {
    const room = await roomOf(c.req.param("id") ?? "", userId);
    if (!room) return { error: fail(c, 404, "not_found") };
    const game = await db.query.classGames.findFirst({ where: and(eq(classGames.id, c.req.param("gameId") ?? ""), eq(classGames.classId, room.id)) });
    if (!game) return { error: fail(c, 404, "not_found") };
    return { room, game };
  }

  app.get("/v1/classes/:id/games/:gameId", requireUser, async (c) => {
    const user = c.get("user");
    const found = await classGame(c, user.id);
    if ("error" in found) return found.error;
    return c.json({ game: await oneGame(found.game, user.id) });
  });

  /** Plays one move: 403 for onlookers and blocked pairs, 409 when it isn't your turn or the game is over, 400 when illegal. */
  app.post("/v1/classes/:id/games/:gameId/moves", requireUser, async (c) => {
    const user = c.get("user");
    if (!moveLimiter(user.id)) return fail(c, 429, "rate_limited");
    const found = await classGame(c, user.id);
    if ("error" in found) return found.error;
    const g = found.game;
    const you = g.whiteId === user.id ? "w" : g.blackId === user.id ? "b" : null;
    if (!you) return fail(c, 403, "forbidden");
    if (await blockedBetween(g.whiteId, g.blackId)) return fail(c, 403, "forbidden");
    if (g.status === "over" || you !== (splitMoves(g.moves).length % 2 ? "b" : "w")) return fail(c, 409, "conflict");
    const b = await body<{ from: string; to: string; promotion: string }>(c);
    const played = playMove(g.moves, String(b.from ?? ""), String(b.to ?? ""), typeof b.promotion === "string" ? b.promotion : undefined);
    if (!played) return fail(c, 400, "invalid_input");
    const next: GameRow = { ...g, moves: played.moves, status: played.over ? "over" : "active", result: played.over?.result ?? null, reason: played.over?.reason ?? null, updatedAt: now().getTime() };
    // Only lands on the position we checked; a second tab's move in between makes this one a 409.
    const res = await db
      .update(classGames)
      .set({ moves: next.moves, status: next.status, result: next.result, reason: next.reason, updatedAt: next.updatedAt })
      .where(and(eq(classGames.id, g.id), eq(classGames.moves, g.moves), eq(classGames.status, "active")));
    if (!res.rowsAffected) return fail(c, 409, "conflict");
    return c.json({ game: await oneGame(next, user.id) });
  });

  app.post("/v1/classes/:id/games/:gameId/resign", requireUser, async (c) => {
    const user = c.get("user");
    if (!moveLimiter(user.id)) return fail(c, 429, "rate_limited");
    const found = await classGame(c, user.id);
    if ("error" in found) return found.error;
    const g = found.game;
    if (g.whiteId !== user.id && g.blackId !== user.id) return fail(c, 403, "forbidden");
    if (g.status === "over") return fail(c, 409, "conflict");
    const next: GameRow = { ...g, status: "over", result: g.whiteId === user.id ? "0-1" : "1-0", reason: "resign", updatedAt: now().getTime() };
    await db.update(classGames).set({ status: next.status, result: next.result, reason: next.reason, updatedAt: next.updatedAt }).where(eq(classGames.id, g.id));
    return c.json({ game: await oneGame(next, user.id) });
  });

  async function tournamentsOf(room: ClassRoom, viewerId: string, only?: string): Promise<Tournament[]> {
    const rows = await db.select().from(tournaments).where(only ? eq(tournaments.id, only) : eq(tournaments.classId, room.id)).orderBy(desc(tournaments.createdAt));
    if (!rows.length) return [];
    const games = await db.select().from(classGames).where(inArray(classGames.tournamentId, rows.map((t) => t.id)));
    const people = await players(games.flatMap((g) => [g.whiteId, g.blackId]));
    const hidden = new Set((await db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, viewerId))).map((b) => b.id));
    return rows.map((t) => {
      const mine = games.filter((g) => g.tournamentId === t.id);
      const table = standings(mine);
      return {
        id: t.id,
        createdAt: t.createdAt,
        done: mine.filter((g) => g.status === "over").length,
        total: mine.length,
        standings: [...table]
          .filter(([id]) => !hidden.has(id))
          .map(([id, s]) => ({ ...(people.get(id) ?? { id, name: "Friend", avatar: "cody" as const }), ...s }))
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
      };
    });
  }

  app.get("/v1/classes/:id/tournaments", requireUser, async (c) => {
    const user = c.get("user");
    const room = await roomOf(c.req.param("id") ?? "", user.id);
    if (!room) return fail(c, 404, "not_found");
    return c.json({ tournaments: await tournamentsOf(room, user.id) });
  });

  /** The class monitor starts a round robin for 3 to 8 members; pairs where one blocked the other are left out. */
  app.post("/v1/classes/:id/tournaments", requireUser, async (c) => {
    const user = c.get("user");
    const room = await roomOf(c.req.param("id") ?? "", user.id);
    if (!room) return fail(c, 404, "not_found");
    if (room.role !== "monitor") return fail(c, 403, "forbidden");
    if (!classWriteLimiter(user.id)) return fail(c, 429, "rate_limited");
    const b = await body<{ players: unknown }>(c);
    const ids = Array.isArray(b.players) ? [...new Set(b.players)] : [];
    const members = new Set(room.members.map((m) => m.id));
    if (ids.length < 3 || ids.length > 8 || !ids.every((id): id is string => typeof id === "string" && members.has(id))) return fail(c, 400, "invalid_input");
    const blocked = await db.select().from(blocks).where(or(inArray(blocks.blockerId, ids), inArray(blocks.blockedId, ids)));
    const apart = new Set(blocked.map((r) => [r.blockerId, r.blockedId].sort().join(" ")));
    const at = now().getTime();
    const id = newId();
    const pairings = roundRobin(ids).filter(([w, bl]) => !apart.has([w, bl].sort().join(" ")));
    await db.batch([
      db.insert(tournaments).values({ id, classId: room.id, createdBy: user.id, createdAt: at }),
      ...pairings.map(([whiteId, blackId]) =>
        db.insert(classGames).values({ id: newId(), classId: room.id, tournamentId: id, whiteId, blackId, moves: "", status: "active", result: null, reason: null, createdAt: at, updatedAt: at }),
      ),
    ]);
    return c.json({ tournament: (await tournamentsOf(room, user.id, id))[0] }, 201);
  });

  /** Anonymous usage events from the apps. No account is needed or recorded. */
  app.post("/v1/events", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
    if (!eventsLimiter(ip)) return fail(c, 429, "rate_limited");
    const rows = parseEvents(await body<unknown>(c), now().getTime());
    if (!rows) return fail(c, 400, "invalid_input");
    await recordEvents(db, rows, now().getTime());
    return c.json({ ok: true, stored: rows.length });
  });

  const requireAdmin = async (c: Context<Vars>, next: () => Promise<void>) => {
    const user = await userFromRequest(c);
    if (!user) return fail(c, 401, "unauthorized");
    if (!admins.has(user.email.toLowerCase())) return fail(c, 403, "forbidden");
    c.set("user", user);
    await next();
  };

  app.get("/v1/admin/usage", requireAdmin, async (c) => {
    const days = Math.min(180, Math.max(1, Number.parseInt(c.req.query("days") ?? "30", 10) || 30));
    return c.json(await usageSummary(db, now().getTime(), days));
  });

  app.get("/v1/admin/reports", requireAdmin, async (c) => {
    const reporter = alias(users, "reporter");
    const rows = await db
      .select({ id: reports.id, reason: reports.reason, note: reports.note, status: reports.status, createdAt: reports.createdAt, className: classes.name, reported: users.name, reporter: reporter.name })
      .from(reports)
      .leftJoin(classes, eq(classes.id, reports.classId))
      .leftJoin(users, eq(users.id, reports.reportedId))
      .leftJoin(reporter, eq(reporter.id, reports.reporterId))
      .orderBy(desc(reports.createdAt))
      .limit(200);
    return c.json({ reports: rows });
  });

  app.patch("/v1/admin/reports/:id", requireAdmin, async (c) => {
    const b = await body<{ status?: string }>(c);
    if (b.status !== "open" && b.status !== "resolved") return fail(c, 400, "invalid_input");
    await db.update(reports).set({ status: b.status }).where(eq(reports.id, c.req.param("id") ?? ""));
    return c.json({ ok: true });
  });

  /* ---------- lesson editor (/admin/lessons) ---------- */

  /** Units and their lessons, with any saved draft. */
  app.get("/v1/admin/course", requireAdmin, async (c) => {
    const [doc, drafts] = await Promise.all([loadCourseDoc(db), loadDrafts(db)]);
    if (!doc) return fail(c, 404, "not_found", "course not seeded");
    return c.json({
      version: doc.version,
      units: doc.units.map((u) => ({
        ...u,
        lessons: doc.lessons.filter((l) => l.unit === u.id).map(({ id, title, sub, minutes, xp }) => ({ id, title, sub, minutes, xp, draft: drafts.has(id) })),
      })),
    });
  });

  app.get("/v1/admin/course/lessons/:id", requireAdmin, async (c) => {
    const id = c.req.param("id") ?? "";
    const [doc, drafts] = await Promise.all([loadCourseDoc(db), loadDrafts(db)]);
    const lesson = doc?.lessons.find((l) => l.id === id);
    if (!lesson) return fail(c, 404, "not_found");
    return c.json({ lesson, draft: drafts.get(id) ?? null });
  });

  /** Runs the seed script's checks on the course with this lesson swapped in. */
  app.post("/v1/admin/course/validate", requireAdmin, async (c) => {
    const doc = await loadCourseDoc(db);
    if (!doc) return fail(c, 404, "not_found", "course not seeded");
    const checked = checkLessonEdit(doc, (await body<{ lesson: unknown }>(c)).lesson);
    return c.json(checked.ok ? { ok: true, errors: [] } : checked);
  });

  /** Drafts may be unfinished, so only their size and id are checked. */
  app.put("/v1/admin/course/drafts/:id", requireAdmin, async (c) => {
    const id = c.req.param("id") ?? "";
    const { lesson } = await body<{ lesson: { id?: unknown } }>(c);
    if (!lesson || typeof lesson !== "object" || lesson.id !== id || JSON.stringify(lesson).length > 200_000) return fail(c, 400, "invalid_input");
    const doc = await loadCourseDoc(db);
    if (!doc?.lessons.some((l) => l.id === id)) return fail(c, 404, "not_found");
    await saveDraft(db, id, lesson, c.get("user").email, now().getTime());
    return c.json({ ok: true });
  });

  app.delete("/v1/admin/course/drafts/:id", requireAdmin, async (c) => {
    await deleteDraft(db, c.req.param("id") ?? "");
    return c.json({ ok: true });
  });

  /** Makes the lesson live under a new course version, logs a snapshot and clears its draft. */
  app.post("/v1/admin/course/publish", requireAdmin, async (c) => {
    const doc = await loadCourseDoc(db);
    if (!doc) return fail(c, 404, "not_found", "course not seeded");
    const { lesson } = await body<{ lesson: { id: string } }>(c);
    const checked = checkLessonEdit(doc, lesson);
    if (!checked.ok) return c.json({ error: "invalid_input", errors: checked.errors }, 400);
    const id = lesson!.id;
    const version = await publishCourse(db, doc, checked.doc, `publish ${id}`, c.get("user").email, now().getTime(), newId);
    await deleteDraft(db, id);
    return c.json({ ok: true, version });
  });

  app.get("/v1/admin/course/versions", requireAdmin, async (c) => c.json({ versions: await listVersions(db) }));

  /** Restores a logged snapshot (as a new version, so every app refetches). */
  app.post("/v1/admin/course/versions/:id/rollback", requireAdmin, async (c) => {
    const [current, snap] = await Promise.all([loadCourseDoc(db), loadVersion(db, c.req.param("id") ?? "")]);
    if (!current || !snap) return fail(c, 404, "not_found");
    // The snapshot was checked when it went live; recheck its shape, not every play-through.
    const checked = checkCourse(snap, () => false);
    if (!checked.ok) return c.json({ error: "invalid_input", errors: checked.errors }, 400);
    const version = await publishCourse(db, current, snap, `rollback to ${snap.version}`, c.get("user").email, now().getTime(), newId);
    return c.json({ ok: true, version });
  });

  async function accessFor(user: UserRow | null) {
    const path = await coursePath();
    const prog = user ? await loadProgress(user.id, path) : emptyProgress();
    return courseAccess(prog.completed, isGuestAccount(user), path);
  }

  /** How far past the learner's place `?offline=1` may fetch (the app still opens them in order). */
  const OFFLINE_AHEAD = 10;

  function refuseLesson(c: Context, access: CourseAccess, id: string) {
    const index = access.path.findIndex((n) => n.id === id);
    const node = access.path[index];
    if (!node || node.playable) return null;
    if (node.lockedReason === "guest") return c.json({ error: GUEST_LIMIT_CODE }, 403);
    const firstLocked = access.path.findIndex((n) => !n.playable);
    if (c.req.query("offline") === "1" && index - firstLocked < OFFLINE_AHEAD) return null;
    return c.json({ error: "lesson_locked" }, 403);
  }

  app.get("/v1/puzzles/pack", async (c) => {
    const pack = await loadPuzzlePack(db);
    if (!pack) return fail(c, 404, "not_found");
    const { etag } = pack;
    c.header("ETag", etag);
    c.header("Cache-Control", PUZZLE_CACHE);
    const inm = c.req.header("If-None-Match");
    if (inm?.split(",").some((part) => part.trim().replace(/^W\//, "") === etag)) return c.body(null, 304);
    return c.json({ version: pack.version, puzzles: pack.puzzles });
  });

  app.get("/v1/puzzles/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return fail(c, 400, "invalid_input");
    const puzzle = await loadPuzzle(db, id);
    if (!puzzle) return fail(c, 404, "not_found");
    c.header("Cache-Control", PUZZLE_CACHE);
    return c.json(puzzle);
  });

  /** The course words in `?lang=` (English when absent or untranslated). */
  const textFor = (c: Context): Promise<CourseText | null> => {
    const lang = c.req.query("lang");
    return lang && isLang(lang) && lang !== "en" ? loadCourseText(db, lang) : Promise.resolve(null);
  };

  app.get("/v1/course", async (c) => {
    const [outline, text] = await Promise.all([loadOutline(db), textFor(c)]);
    if (!outline) return fail(c, 404, "not_found");
    const signedIn = Boolean(await userFromRequest(c));
    const steps = c.req.query("outline") === "1" ? null : new Map((await loadLessonsWithSteps(db)).map((l) => [l.id, l.steps]));
    return c.json({
      version: outline.version,
      units: localizeNamed(outline.units, text?.units),
      lessons: localizeNamed(outline.lessons, text?.lessons).map((lesson, index) => ({
        ...lesson,
        guestLocked: !signedIn && index >= GUEST_CLASS_LIMIT,
        ...(steps ? { steps: localizeSteps(steps.get(lesson.id) ?? [], text?.lessons[lesson.id]?.steps) } : {}),
      })),
      comingSoon: localizeNamed(outline.comingSoon, text?.comingSoon),
    });
  });

  app.get("/v1/lessons/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return fail(c, 400, "invalid_input");
    const [found, text, ideas] = await Promise.all([loadLesson(db, id), textFor(c), loadIdeas(db, [id])]);
    if (!found) return fail(c, 404, "not_found");
    const access = await accessFor(await userFromRequest(c));
    const refused = refuseLesson(c, access, id);
    if (refused) return refused;
    const t = text?.lessons[id];
    const lesson = { ...found, idea: t?.idea || ideas.get(id) };
    return c.json(t ? { ...lesson, title: t.title || lesson.title, sub: t.sub || lesson.sub, steps: localizeSteps(lesson.steps, t.steps) } : lesson);
  });

  /** Key ideas for flashcards: ?ids=a,b (up to 50). Lessons the caller can't open are left out. */
  app.get("/v1/ideas", async (c) => {
    const access = await accessFor(await userFromRequest(c));
    const open = new Set(access.path.filter((n) => n.playable).map((n) => n.id));
    const ids = [...new Set((c.req.query("ids") ?? "").split(","))].filter((id) => open.has(id)).slice(0, 50);
    const [outline, text, ideas] = await Promise.all([ids.length ? loadOutline(db) : null, textFor(c), loadIdeas(db, ids)]);
    const titles = new Map(outline?.lessons.map((l) => [l.id, l.title]));
    const items = ids.flatMap((id) => {
      const t = text?.lessons[id];
      const idea = t?.idea || ideas.get(id);
      return idea ? [{ id, title: t?.title || titles.get(id) || id, idea }] : [];
    });
    return c.json({ items });
  });

  /**
   * A practice set from lessons the learner has finished. Body: { lessons, review, count }.
   * Lessons the caller can't open (a guest past the free lessons) are skipped, never an error.
   */
  app.post("/v1/practice", async (c) => {
    const b = await body<{ lessons?: unknown; review?: unknown; count?: unknown; weak?: unknown }>(c);
    const ids = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 80).slice(0, max) : []);
    const access = await accessFor(await userFromRequest(c));
    const open = new Set(access.path.filter((n) => n.playable).map((n) => n.id));
    const lessons = [...new Set(ids(b.lessons, 300))].filter((id) => open.has(id));
    const count = typeof b.count === "number" && Number.isInteger(b.count) ? Math.min(MAX_PRACTICE, Math.max(1, b.count)) : 5;
    const text = await textFor(c);
    const loaded = (await loadLessonSteps(db, lessons)).map((l) => ({ ...l, steps: localizeSteps(l.steps, text?.lessons[l.id]?.steps) }));
    const items = pickPractice(loaded, ids(b.review, 50), count, Math.random, ids(b.weak, 8).filter(isSkillId));
    return c.json({ items });
  });

  /** A coach's recorded clips for one lesson. Empty while that coach's voice isn't recorded yet. */
  app.get("/v1/voice/:coach/:lesson", async (c) => {
    const coach = c.req.param("coach") ?? "";
    if (!isCoachId(coach)) return fail(c, 404, "not_found");
    const [lesson, text] = await Promise.all([loadLesson(db, c.req.param("lesson") ?? ""), textFor(c)]);
    if (!lesson) return fail(c, 404, "not_found");
    c.header("Cache-Control", "public, max-age=300");
    const voice = text ? HINDI_VOICE : coach;
    return c.json({ coach, clips: await lessonClips(db, voice, localizeSteps(lesson.steps, text?.lessons[lesson.id]?.steps)) });
  });

  /**
   * The placement quiz: the first exercise of eight lessons spread across the course, easiest first.
   * Open to guests; each item says which lesson it stands for.
   */
  app.get("/v1/placement", async (c) => {
    const [loaded, text] = await Promise.all([loadLessonSteps(db, [...PLACEMENT_LESSONS]), textFor(c)]);
    const byId = new Map(loaded.map((l) => [l.id, localizeSteps(l.steps, text?.lessons[l.id]?.steps)]));
    const items = PLACEMENT_LESSONS.flatMap((lesson) => {
      const step = byId.get(lesson)?.find((s) => s.kind !== "say" && s.kind !== "game");
      return step ? [{ lesson, step }] : [];
    });
    return c.json({ items });
  });

  /** The weekly parent summary opt-in. */
  app.get("/v1/me/weekly", requireUser, async (c) => {
    const row = await db.query.weeklySummary.findFirst({ where: eq(weeklySummary.userId, c.get("user").id) });
    return c.json({ email: Boolean(row?.email), push: Boolean(row?.pushToken) });
  });

  app.put("/v1/me/weekly", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<{ email?: unknown; pushToken?: unknown; lang?: unknown }>(c);
    if (typeof b.email !== "boolean") return fail(c, 400, "invalid_input");
    const pushToken = typeof b.pushToken === "string" && /^ExponentPushToken\[[\w-]{10,200}\]$/.test(b.pushToken) ? b.pushToken : null;
    const lang = b.lang === "hi" ? "hi" : "en";
    if (!b.email && !pushToken) {
      await db.delete(weeklySummary).where(eq(weeklySummary.userId, user.id));
      return c.json({ email: false, push: false });
    }
    const prog = await loadProgress(user.id, await coursePath());
    const set = { email: b.email, pushToken, lang };
    await db
      .insert(weeklySummary)
      .values({ userId: user.id, ...set, lastPuzzles: prog.puzzles.solved })
      .onConflictDoUpdate({ target: weeklySummary.userId, set });
    return c.json({ email: b.email, push: Boolean(pushToken) });
  });

  /**
   * Daily cron: sends each opted-in learner's summary on Sunday, or later if a Sunday was missed.
   * Emails per run are capped under the email plan's daily limit; the rest go out the next day.
   */
  app.get("/v1/cron/weekly", async (c) => {
    if (!cronSecret || c.req.header("authorization") !== `Bearer ${cronSecret}`) return fail(c, 404, "not_found");
    if (!weekly) return c.json({ sent: 0, skipped: "no sender" });
    const today = dayKey(now());
    const weekAgo = new Date(now().getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
    const sunday = now().getUTCDay() === 0;
    const rows = await db.select().from(weeklySummary);
    const due = rows.filter((r) => r.lastSent !== today && (sunday ? true : !r.lastSent || r.lastSent <= weekAgo));
    const [outline, path] = await Promise.all([loadOutline(db), coursePath()]);
    const texts = { hi: await loadCourseText(db, "hi") };
    let emails = 0;
    let pushes = 0;
    for (const r of due) {
      if (r.email && emails >= EMAIL_RUN_CAP) continue;
      const user = await db.query.users.findFirst({ where: eq(users.id, r.userId) });
      if (!user) continue;
      const p = await loadProgress(user.id, path);
      const nextLesson = outline?.lessons.find((l) => !p.completed[l.id]);
      const unit = nextLesson ? outline?.units.find((u) => u.id === nextLesson.unit) : null;
      const unitTitle = unit ? (r.lang === "hi" ? texts.hi?.units[unit.id]?.title || unit.title : unit.title) : null;
      const msg = summaryMessage(summarize(user.name, p, r.lastPuzzles, today, unitTitle), r.lang);
      let ok = false;
      if (r.email && (await weekly.email(user.email, msg.subject, msg.html, msg.text).catch(() => false))) {
        emails++;
        ok = true;
      }
      if (r.pushToken && (await weekly.push(r.pushToken, msg.subject, msg.push).catch(() => false))) {
        pushes++;
        ok = true;
      }
      if (ok) await db.update(weeklySummary).set({ lastSent: today, lastPuzzles: p.puzzles.solved }).where(eq(weeklySummary.userId, r.userId));
    }
    return c.json({ due: due.length, emails, pushes });
  });

  /**
   * The AI coach explains a finished game. Body: { startFen, moves, side, coach, consent: true }.
   * The server works out the facts from the moves itself; providers only ever see those facts.
   */
  app.post("/v1/coach/explain", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<{ startFen: unknown; moves: unknown; side: unknown; coach: unknown; consent: unknown }>(c);
    if (b.consent !== true) return fail(c, 403, "consent_required");
    const input = parseCoachInput(b, isCoachId);
    if (!input) return fail(c, 400, "invalid_input");
    if (!coachLimiter(user.id)) return fail(c, 429, "rate_limited");
    const lang = c.req.query("lang") === "hi" ? "hi" : "en";
    const answer = await explainGame(db, coachAi, input, lang, user.id, dayKey(now()), now().getTime());
    if (answer === "limit") return fail(c, 429, "rate_limited");
    if (!answer) return fail(c, 503, "server");
    return c.json(answer);
  });

  /** Recent games of a Lichess or Chess.com player. Body: { source, username }. The name is not stored. */
  app.post("/v1/import/games", requireUser, async (c) => {
    const b = await body<{ source: unknown; username: unknown }>(c);
    if ((b.source !== "lichess" && b.source !== "chesscom") || !isUsername(b.username)) return fail(c, 400, "invalid_input");
    if (!importLimiter(c.get("user").id)) return fail(c, 429, "rate_limited");
    const games = await (b.source === "lichess" ? lichessGames : chesscomGames)(b.username, importFetch);
    if (!games) return fail(c, 404, "not_found");
    return c.json({ games });
  });

  /** One pasted PGN game. Body: { pgn }. */
  app.post("/v1/import/pgn", requireUser, async (c) => {
    const b = await body<{ pgn: unknown }>(c);
    if (typeof b.pgn !== "string" || b.pgn.length > PGN_MAX_BYTES) return fail(c, 400, "invalid_input");
    if (!importLimiter(c.get("user").id)) return fail(c, 429, "rate_limited");
    const game = gameFromPgn(b.pgn, `pgn:${now().getTime()}`, null, now().getTime());
    if (!game) return fail(c, 400, "invalid_input");
    return c.json({ games: [game] });
  });

  /** Perfect defence for the endgame trainer. 503 when the tablebase can't be reached (the app falls back to its bot). */
  app.get("/v1/tablebase", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
    if (!tablebaseLimiter(ip)) return fail(c, 429, "rate_limited");
    const key = tablebaseKey(c.req.query("fen") ?? "");
    if (!key) return fail(c, 400, "invalid_input");
    const answer = await bestEndgameMove(db, key, tablebase);
    if (!answer) return fail(c, 503, "server");
    c.header("Cache-Control", "public, max-age=86400");
    return c.json(answer);
  });

  /**
   * A unit the learner has finished, per their saved progress and the course path: its title in
   * `lang` and the day its last lesson was done. 404 for an unknown unit, 403 while unfinished.
   */
  async function finishedUnit(c: Context, userId: string, unitId: string, lang: Lang) {
    const path = await coursePath();
    const lessons = path.filter((n) => n.unit === unitId);
    if (!lessons.length) return fail(c, 404, "not_found");
    const done = (await loadProgress(userId, path)).completed;
    const days = lessons.map((n) => done[n.id]);
    if (days.some((d) => !d)) return fail(c, 403, "forbidden");
    const [row, text] = await Promise.all([db.select({ title: courseUnits.title }).from(courseUnits).where(eq(courseUnits.id, unitId)).get(), lang === "en" ? null : loadCourseText(db, lang)]);
    return { title: text?.units[unitId]?.title || row?.title || unitId, day: days.sort().at(-1)! };
  }
  const certLang = (c: Context): Lang => {
    const lang = c.req.query("lang");
    return lang && isLang(lang) ? lang : "en";
  };

  /** A print-ready SVG certificate. Signed in, or with a share token from the link route. */
  app.get("/v1/certificates/:unitId", async (c) => {
    const unitId = c.req.param("unitId") ?? "";
    const t = c.req.query("t");
    let user: UserRow | null | undefined;
    if (t) {
      const id = certKey ? readCertToken(certKey, t, unitId, now().getTime()) : null;
      if (!id) return fail(c, 403, "forbidden");
      user = await db.query.users.findFirst({ where: eq(users.id, id) });
    } else user = await userFromRequest(c);
    if (!user) return fail(c, 401, "unauthorized");
    const lang = certLang(c);
    const unit = await finishedUnit(c, user.id, unitId, lang);
    if (unit instanceof Response) return unit;
    c.header("Content-Type", "image/svg+xml; charset=utf-8");
    c.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    c.header("Cache-Control", "private, max-age=300");
    return c.body(certificateSvg({ name: user.name, unit: unit.title, day: unit.day, lang }));
  });

  /** A link to the certificate that works without a session, for sharing. Valid CERT_LINK_DAYS. */
  app.post("/v1/certificates/:unitId/link", requireUser, async (c) => {
    if (!certKey) return fail(c, 503, "server", "CERT_SECRET is not set");
    const unitId = c.req.param("unitId") ?? "";
    const lang = certLang(c);
    const unit = await finishedUnit(c, c.get("user").id, unitId, lang);
    if (unit instanceof Response) return unit;
    const path = `/v1/certificates/${encodeURIComponent(unitId)}?t=${certToken(certKey, c.get("user").id, unitId, now().getTime())}${lang === "en" ? "" : `&lang=${lang}`}`;
    return c.json({ url: new URL(path, c.req.url).toString(), path, unit: unit.title });
  });

  app.get("/v1/home", requireUser, async (c) => {
    const user = c.get("user");
    const path = await coursePath();
    const [prof, prog] = await Promise.all([loadProfile(user.id), loadProgress(user.id, path)]);
    const qDay = c.req.query("day");
    const today = qDay && /^\d{4}-\d{2}-\d{2}$/.test(qDay) ? qDay : dayKey(now());
    const access = courseAccess(prog.completed, isGuestAccount(user), path);
    const current = access.path.find((n) => n.state === "current");
    const lastDone = [...access.path].reverse().find((n) => n.state === "done");
    const fallback = access.path[access.path.length - 1];
    const home: HomeResponse = {
      name: user.name,
      streak: visibleStreak(prog.streak, today),
      dailyMinutes: prof.dailyMinutes,
      xp: prog.xp,
      today: current ? { nodeId: current.id, state: "current" } : { nodeId: (lastDone ?? fallback).id, state: "done" },
      path: access.path,
      rooms: [
        { id: "play", open: true },
        { id: "practice", open: true },
        { id: "club", open: false },
      ],
    };
    return c.json(home);
  });

  /* ---------- child profiles (one parent account, several learners) ---------- */

  const MAX_CHILDREN = 5;
  const childOf = (userId: string, id: string) => db.query.children.findFirst({ where: and(eq(children.id, id), eq(children.userId, userId)) });

  async function loadChildProgress(childId: string, path: PathEntry[]): Promise<Progress> {
    const row = await db.query.childProgress.findFirst({ where: eq(childProgress.childId, childId) });
    if (!row) return emptyProgress();
    try {
      const parsed = JSON.parse(row.data);
      return isProgress(parsed) ? (path.length ? sanitizeProgress(parsed, path) : parsed) : emptyProgress();
    } catch {
      return emptyProgress();
    }
  }

  app.get("/v1/children", requireUser, async (c) => {
    const rows = await db.select({ id: children.id, name: children.name, avatar: children.avatar }).from(children).where(eq(children.userId, c.get("user").id)).orderBy(children.createdAt);
    return c.json({ children: rows });
  });

  app.post("/v1/children", requireUser, async (c) => {
    const user = c.get("user");
    if (isGuestAccount(user)) return fail(c, 403, "forbidden");
    const b = await body<{ name?: unknown; avatar?: unknown }>(c);
    const name = cleanName(String(b.name ?? ""));
    if (!name) return fail(c, 400, "invalid_input");
    const count = (await db.select({ id: children.id }).from(children).where(eq(children.userId, user.id))).length;
    if (count >= MAX_CHILDREN) return fail(c, 409, "invalid_input", "profile limit");
    const child = { id: newId(), userId: user.id, name, avatar: isAvatarId(b.avatar) ? b.avatar : "cody", createdAt: now().getTime() };
    await db.insert(children).values(child);
    return c.json({ child: { id: child.id, name: child.name, avatar: child.avatar } }, 201);
  });

  app.delete("/v1/children/:id", requireUser, async (c) => {
    const child = await childOf(c.get("user").id, c.req.param("id") ?? "");
    if (!child) return fail(c, 404, "not_found");
    await db.batch([db.delete(childProgress).where(eq(childProgress.childId, child.id)), db.delete(children).where(eq(children.id, child.id))]);
    return c.json({ ok: true });
  });

  app.get("/v1/children/:id/progress", requireUser, async (c) => {
    const child = await childOf(c.get("user").id, c.req.param("id") ?? "");
    if (!child) return fail(c, 404, "not_found");
    return c.json({ progress: await loadChildProgress(child.id, await coursePath()) });
  });

  /** Same merge-and-check rules as the account's own progress. */
  app.put("/v1/children/:id/progress", requireUser, async (c) => {
    const child = await childOf(c.get("user").id, c.req.param("id") ?? "");
    if (!child) return fail(c, 404, "not_found");
    const b = await body<{ progress: Progress }>(c);
    if (!isProgress(b.progress)) return fail(c, 400, "invalid_input");
    const path = await coursePath();
    if (!path.length) return fail(c, 503, "server", "course not seeded");
    const merged = sanitizeProgress(mergeProgress(await loadChildProgress(child.id, path), sanitizeProgress(b.progress, path)), path);
    const data = JSON.stringify(merged);
    const t = now().getTime();
    await db.insert(childProgress).values({ childId: child.id, data, updatedAt: t }).onConflictDoUpdate({ target: childProgress.childId, set: { data, updatedAt: t } });
    return c.json({ progress: merged });
  });

  app.put("/v1/progress", requireUser, async (c) => {
    const user = c.get("user");
    const b = await body<{ progress: Progress }>(c);
    if (!isProgress(b.progress)) return fail(c, 400, "invalid_input");
    const path = await coursePath();
    if (!path.length) return fail(c, 503, "server", "course not seeded");
    const merged = sanitizeProgress(mergeProgress(await loadProgress(user.id, path), sanitizeProgress(b.progress, path)), path);
    if (isGuestAccount(user) && (guestProgressOverreach(b.progress.completed, path) || guestProgressOverreach(merged.completed, path))) {
      return c.json({ error: GUEST_LIMIT_CODE }, 403);
    }
    await saveProgress(user.id, merged);
    const access = courseAccess(merged.completed, isGuestAccount(user), path);
    return c.json({ progress: merged, path: access.path });
  });

  return app;
}
