import {
  cleanName,
  dayKey,
  emptyProgress,
  isAvatarId,
  isFlairId,
  isProgress,
  mergeProgress,
  PATH,
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
import { and, eq, gt, lt } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { deleteUserData } from "./account-delete";
import { courseAccess, guestProgressOverreach, GUEST_CLASS_LIMIT, GUEST_LIMIT_CODE, isGuestAccount, type CourseAccess } from "./access";
import type { AppleVerifier } from "./apple";
import type { Db } from "./db";
import type { GoogleVerifier } from "./google";
import { classMembers, classes, course, feedback, profiles, progress, sessions, users } from "./schema";
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
};

type UserRow = typeof users.$inferSelect;
type Vars = { Variables: { user: UserRow } };

const fail = (c: Context, status: number, error: ApiErrorCode, message?: string) =>
  c.json({ error, message }, status as 400);

const WHO = new Set(["me", "child", "class"]);
const MINUTES = new Set([5, 10, 15]);
const APPEARANCE = new Set(["system", "light", "dark"]);

export function createApp({ db, google, apple = null, secureCookies, corsOrigins, now = () => new Date() }: AppDeps) {
  const app = new Hono<Vars>();
  const authLimiter = createRateLimiter(12, 60_000, () => now().getTime());
  const feedbackLimiter = createRateLimiter(5, 10 * 60_000, () => now().getTime());

  const loadCourse = async () => {
    const row = await db.query.course.findFirst({ where: eq(course.id, "live") });
    return row ? (JSON.parse(row.data) as { units: unknown[]; lessons: { id: string; steps?: unknown[] }[] }) : null;
  };

  app.use("/v1/*", cors({ origin: corsOrigins, credentials: true, allowHeaders: ["Content-Type", "Authorization"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));

  app.onError((err, c) => {
    console.error(err);
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

  async function loadProgress(userId: string): Promise<Progress> {
    const row = await db.query.progress.findFirst({ where: eq(progress.userId, userId) });
    if (!row) return emptyProgress();
    try {
      const parsed = JSON.parse(row.data);
      return isProgress(parsed) ? sanitizeProgress(parsed) : emptyProgress();
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
    const current = await loadProgress(user.id);
    if (!guest?.progress || !isProgress(guest.progress)) return current;
    const merged = sanitizeProgress(mergeProgress(current, sanitizeProgress(guest.progress)));
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
      if (byEmail) {
        if (!identity.emailVerified) return fail(c, 401, "google_invalid");
        await db.update(users).set({ googleSub: identity.sub }).where(eq(users.id, byEmail.id));
        user = { ...byEmail, googleSub: identity.sub };
        await applyGuestProfile(user.id, guest, false);
      } else {
        const guestName = cleanName(String(guest?.profile?.name ?? ""));
        user = { id: newId(), email: identity.email, name: guestName || cleanName(identity.name) || "", passwordHash: null, googleSub: identity.sub, appleSub: null, guestId: guest?.guestId ?? null, kind: "member", createdAt: now().getTime() };
        await db.insert(users).values(user);
        await applyGuestProfile(user.id, guest, true);
      }
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
    const nonce = typeof b.nonce === "string" && b.nonce.length > 0 ? b.nonce : undefined;
    const identity = typeof b.identityToken === "string" ? await apple(b.identityToken, nonce) : null;
    if (!identity) return c.json({ error: "apple_invalid" }, 401);
    const guest = guestOf(b);
    let user = await db.query.users.findFirst({ where: eq(users.appleSub, identity.sub) });
    if (!user) {
      const byEmail = identity.email ? await db.query.users.findFirst({ where: eq(users.email, identity.email) }) : undefined;
      if (byEmail && identity.emailVerified) {
        if (byEmail.appleSub && byEmail.appleSub !== identity.sub) return c.json({ error: "apple_invalid" }, 401);
        await db.update(users).set({ appleSub: identity.sub }).where(eq(users.id, byEmail.id));
        user = { ...byEmail, appleSub: identity.sub };
        await applyGuestProfile(user.id, guest, false);
      } else if (byEmail) {
        return c.json({ error: "apple_invalid" }, 401);
      } else if (!identity.email) {
        return c.json({ error: "apple_invalid" }, 401);
      } else {
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
      .select({ id: users.id, name: users.name, role: classMembers.role })
      .from(classMembers)
      .innerJoin(users, eq(users.id, classMembers.userId))
      .where(eq(classMembers.classId, classId));
    const me = members.find((m) => m.id === viewerId);
    if (!me) return null;
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      role: me.role === "monitor" ? "monitor" : "student",
      members: members.map((m) => ({ id: m.id, name: m.name || "Friend", role: m.role === "monitor" ? "monitor" : "student" })),
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
    return c.html(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${row.name}</title><p>Join ${row.name}. Code ${code}.</p><script>
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

  type CourseDoc = { units: unknown[]; lessons: { id: string; steps?: unknown[] }[] };

  async function accessFor(user: UserRow | null) {
    const prog = user ? await loadProgress(user.id) : emptyProgress();
    return courseAccess(prog.completed, isGuestAccount(user));
  }

  function presentCourse(doc: CourseDoc, signedIn: boolean, withSteps: boolean) {
    return {
      units: doc.units,
      lessons: doc.lessons.map((lesson) => {
        const index = PATH.findIndex((node) => node.id === lesson.id);
        const { steps, ...rest } = lesson;
        return {
          ...rest,
          guestLocked: !signedIn && index >= GUEST_CLASS_LIMIT,
          ...(withSteps ? { steps: steps ?? [] } : {}),
        };
      }),
    };
  }

  function refuseLesson(c: Context, access: CourseAccess, id: string) {
    const node = access.path.find((n) => n.id === id);
    if (!node || node.playable) return null;
    if (node.lockedReason === "guest") return c.json({ error: GUEST_LIMIT_CODE }, 403);
    return c.json({ error: "lesson_locked" }, 403);
  }

  app.get("/v1/course", async (c) => {
    const doc = await loadCourse();
    if (!doc) return fail(c, 404, "not_found");
    const user = await userFromRequest(c);
    return c.json(presentCourse(doc, Boolean(user), c.req.query("outline") !== "1"));
  });

  app.get("/v1/lessons/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return fail(c, 400, "invalid_input");
    const doc = await loadCourse();
    const lesson = doc?.lessons.find((l) => l.id === id);
    if (!lesson) return fail(c, 404, "not_found");
    const access = await accessFor(await userFromRequest(c));
    const refused = refuseLesson(c, access, id);
    if (refused) return refused;
    return c.json(lesson);
  });

  app.get("/v1/home", requireUser, async (c) => {
    const user = c.get("user");
    const [prof, prog] = await Promise.all([loadProfile(user.id), loadProgress(user.id)]);
    const qDay = c.req.query("day");
    const today = qDay && /^\d{4}-\d{2}-\d{2}$/.test(qDay) ? qDay : dayKey(now());
    const access = courseAccess(prog.completed, isGuestAccount(user));
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
    const merged = sanitizeProgress(mergeProgress(await loadProgress(user.id), sanitizeProgress(b.progress)));
    if (isGuestAccount(user) && (guestProgressOverreach(b.progress.completed) || guestProgressOverreach(merged.completed))) {
      return c.json({ error: GUEST_LIMIT_CODE }, 403);
    }
    await saveProgress(user.id, merged);
    const access = courseAccess(merged.completed, isGuestAccount(user));
    return c.json({ progress: merged, path: access.path });
  });

  return app;
}
