import {
  cleanName,
  dayKey,
  emptyProgress,
  isAvatarId,
  isCoachId,
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
  type ClassRoom,
  type AuthResponse,
  type DailyMinutes,
  type GuestPayload,
  type HomeResponse,
  type Progress,
} from "@chessschool/design";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { deleteUserData } from "./account-delete";
import { courseAccess, guestProgressOverreach, GUEST_CLASS_LIMIT, GUEST_LIMIT_CODE, isGuestAccount, type CourseAccess } from "./access";
import { loadLesson, loadLessonSteps, loadLessonsWithSteps, loadOutline, loadPath, type PathEntry } from "./course";
import { MAX_PRACTICE, pickPractice } from "./practice";
import { lessonClips } from "./voice";
import { loadPuzzle, loadPuzzlePack, PUZZLE_CACHE } from "./puzzles";
import type { AppleVerifier } from "./apple";
import type { Db } from "./db";
import type { GoogleVerifier } from "./google";
import { blocks, classMembers, classes, feedback, profiles, progress, reports, sessions, users } from "./schema";
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
  /** Crash reporting hook (Sentry in production). Gets the error only, never the request body. */
  reportError?: (err: unknown) => Promise<void> | void;
};

const REPORT_REASONS = ["name", "behaviour", "other"] as const;

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

export function createApp({ db, google, apple = null, secureCookies, corsOrigins, now = () => new Date(), adminEmails = [], reportError }: AppDeps) {
  const app = new Hono<Vars>();
  const authLimiter = createRateLimiter(12, 60_000, () => now().getTime());
  const feedbackLimiter = createRateLimiter(5, 10 * 60_000, () => now().getTime());
  const eventsLimiter = createRateLimiter(30, 60_000, () => now().getTime());
  const reportLimiter = createRateLimiter(10, 60 * 60_000, () => now().getTime());
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
    if (row.ownerId === user.id) await db.delete(classes).where(eq(classes.id, id));
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

  async function accessFor(user: UserRow | null) {
    const path = await coursePath();
    const prog = user ? await loadProgress(user.id, path) : emptyProgress();
    return courseAccess(prog.completed, isGuestAccount(user), path);
  }

  function refuseLesson(c: Context, access: CourseAccess, id: string) {
    const node = access.path.find((n) => n.id === id);
    if (!node || node.playable) return null;
    if (node.lockedReason === "guest") return c.json({ error: GUEST_LIMIT_CODE }, 403);
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

  app.get("/v1/course", async (c) => {
    const outline = await loadOutline(db);
    if (!outline) return fail(c, 404, "not_found");
    const signedIn = Boolean(await userFromRequest(c));
    const steps = c.req.query("outline") === "1" ? null : new Map((await loadLessonsWithSteps(db)).map((l) => [l.id, l.steps]));
    return c.json({
      version: outline.version,
      units: outline.units,
      lessons: outline.lessons.map((lesson, index) => ({
        ...lesson,
        guestLocked: !signedIn && index >= GUEST_CLASS_LIMIT,
        ...(steps ? { steps: steps.get(lesson.id) ?? [] } : {}),
      })),
      comingSoon: outline.comingSoon,
    });
  });

  app.get("/v1/lessons/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return fail(c, 400, "invalid_input");
    const lesson = await loadLesson(db, id);
    if (!lesson) return fail(c, 404, "not_found");
    const access = await accessFor(await userFromRequest(c));
    const refused = refuseLesson(c, access, id);
    if (refused) return refused;
    return c.json(lesson);
  });

  /**
   * A practice set from lessons the learner has finished. Body: { lessons, review, count }.
   * Lessons the caller can't open (a guest past the free lessons) are skipped, never an error.
   */
  app.post("/v1/practice", async (c) => {
    const b = await body<{ lessons?: unknown; review?: unknown; count?: unknown }>(c);
    const ids = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 80).slice(0, max) : []);
    const access = await accessFor(await userFromRequest(c));
    const open = new Set(access.path.filter((n) => n.playable).map((n) => n.id));
    const lessons = [...new Set(ids(b.lessons, 300))].filter((id) => open.has(id));
    const count = typeof b.count === "number" && Number.isInteger(b.count) ? Math.min(MAX_PRACTICE, Math.max(1, b.count)) : 5;
    const items = pickPractice(await loadLessonSteps(db, lessons), ids(b.review, 50), count);
    return c.json({ items });
  });

  /** A coach's recorded clips for one lesson. Empty while that coach's voice isn't recorded yet. */
  app.get("/v1/voice/:coach/:lesson", async (c) => {
    const coach = c.req.param("coach") ?? "";
    if (!isCoachId(coach)) return fail(c, 404, "not_found");
    const lesson = await loadLesson(db, c.req.param("lesson") ?? "");
    if (!lesson) return fail(c, 404, "not_found");
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ coach, clips: await lessonClips(db, coach, lesson.steps) });
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
