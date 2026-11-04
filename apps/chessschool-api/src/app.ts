import {
  cleanName,
  dayKey,
  emptyProgress,
  isProgress,
  mergeProgress,
  nextNode,
  PATH,
  pathStates,
  sanitizeProgress,
  validEmail,
  validPassword,
  visibleStreak,
  type Account,
  type ApiErrorCode,
  type ApiProfile,
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
import type { Db } from "./db";
import type { GoogleVerifier } from "./google";
import { feedback, profiles, progress, sessions, users } from "./schema";
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

export type AppDeps = {
  db: Db;
  google: GoogleVerifier | null;
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

export function createApp({ db, google, secureCookies, corsOrigins, now = () => new Date() }: AppDeps) {
  const app = new Hono<Vars>();
  const authLimiter = createRateLimiter(12, 60_000, () => now().getTime());
  const feedbackLimiter = createRateLimiter(5, 10 * 60_000, () => now().getTime());

  app.use("/v1/*", cors({ origin: corsOrigins, credentials: true, allowHeaders: ["Content-Type", "Authorization"], allowMethods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"] }));

  app.onError((err, c) => {
    console.error(err);
    return fail(c, 500, "server");
  });
  app.notFound((c) => fail(c, 404, "not_found"));

  /* ---------- helpers ---------- */

  const toAccount = (u: UserRow): Account => ({ id: u.id, email: u.email, name: u.name, provider: u.passwordHash ? "password" : "google" });

  async function loadProfile(userId: string): Promise<ApiProfile> {
    const row = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
    return {
      name: "",
      who: (row?.who as ApiProfile["who"]) ?? null,
      dailyMinutes: ((row?.dailyMinutes ?? 10) as DailyMinutes),
      appearance: (row?.appearance as ApiProfile["appearance"]) ?? "system",
      sound: row?.sound ?? true,
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
    };
    await db.insert(profiles).values(values).onConflictDoUpdate({ target: profiles.userId, set: values });
  }

  /* ---------- routes ---------- */

  app.get("/v1/health", (c) => c.json({ ok: true, version: API_VERSION, time: now().toISOString() }));

  app.post("/v1/auth/register", limitAuth, async (c) => {
    const b = await body<{ name: string; email: string; password: string; guest: GuestPayload }>(c);
    const name = cleanName(String(b.name ?? ""));
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!name || !validEmail(email) || !validPassword(password)) return fail(c, 400, "invalid_input");
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) return fail(c, 409, "email_taken");
    const guest = guestOf(b);
    const user: UserRow = { id: newId(), email, name, passwordHash: await hashPassword(password), googleSub: null, guestId: guest?.guestId ?? null, createdAt: now().getTime() };
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
        user = { id: newId(), email: identity.email, name: guestName || cleanName(identity.name) || "", passwordHash: null, googleSub: identity.sub, guestId: guest?.guestId ?? null, createdAt: now().getTime() };
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

  /** Permanently deletes the account and everything stored for it on this server (cascade). */
  app.delete("/v1/me", requireUser, async (c) => {
    const user = c.get("user");
    await db.delete(users).where(eq(users.id, user.id));
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
    await applyGuestProfile(user.id, { guestId: "patch", profile: b }, true);
    return c.json({ user: toAccount(user), profile: { ...(await loadProfile(user.id)), name: user.name } });
  });

  app.get("/v1/home", requireUser, async (c) => {
    const user = c.get("user");
    const [prof, prog] = await Promise.all([loadProfile(user.id), loadProgress(user.id)]);
    const qDay = c.req.query("day");
    const today = qDay && /^\d{4}-\d{2}-\d{2}$/.test(qDay) ? qDay : dayKey(now());
    const path = pathStates(prog);
    const next = nextNode(prog);
    const home: HomeResponse = {
      name: user.name,
      streak: visibleStreak(prog.streak, today),
      dailyMinutes: prof.dailyMinutes,
      xp: prog.xp,
      today: next ? { nodeId: next.id, state: "current" } : { nodeId: PATH[PATH.length - 1].id, state: "done" },
      path,
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
    await saveProgress(user.id, merged);
    return c.json({ progress: merged });
  });

  return app;
}
