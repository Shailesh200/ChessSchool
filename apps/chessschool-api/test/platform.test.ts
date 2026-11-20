import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthResponse } from "@chessschool/design";
import { createApp } from "../src/app";
import type { Db } from "../src/db";
import { emailPrefs, readUnsubToken, takeEmailSlot, unsubToken, welcomeMessage, winbackMessage } from "../src/lifecycle";
import { dbRateStore, memoryRateStore, rateLimits, ruleFor, type Rule } from "../src/rate-limit";
import { progress, users, weeklySummary } from "../src/schema";
import { Hono } from "hono";
import { seededDb } from "./course-fixture";

const DAY = 86_400_000;

describe("rate limits", () => {
  it("picks the strict budget for sign-up, challenges and uploads, and none for health and preflight", () => {
    expect(ruleFor("POST", "/v1/auth/register")?.name).toBe("signup");
    expect(ruleFor("POST", "/v1/auth/google")?.name).toBe("signin");
    expect(ruleFor("POST", "/v1/challenges")?.name).toBe("challenge-create");
    expect(ruleFor("POST", "/v1/challenges/abc234/accept")?.name).toBe("challenge-join");
    expect(ruleFor("POST", "/v1/challenges/abc234/moves")?.name).toBe("challenge-play");
    expect(ruleFor("POST", "/v1/classes/x/members/y/report")?.name).toBe("report");
    expect(ruleFor("POST", "/v1/scan")?.name).toBe("upload");
    expect(ruleFor("GET", "/v1/challenges/abc234")?.name).toBe("general");
    expect(ruleFor("GET", "/v1/leaderboard")?.name).toBe("general");
    expect(ruleFor("GET", "/v1/health")).toBeNull();
    expect(ruleFor("GET", "/health")).toBeNull();
    expect(ruleFor("OPTIONS", "/v1/auth/register")).toBeNull();
    expect(ruleFor("GET", "/v1/cron/weekly")).toBeNull();
  });

  const rules: Rule[] = [{ name: "t", shared: true, path: /^\/v1\//, ip: { limit: 3, windowMs: 60_000 }, user: { limit: 2, windowMs: 60_000 } }];
  const appWith = (store = memoryRateStore(), now = () => 1_000) => {
    const app = new Hono();
    app.use("*", rateLimits({ store, now, rules }));
    app.get("/v1/x", (c) => c.json({ ok: true }));
    app.get("/v1/busy", (c) => c.json({ error: "rate_limited" }, 429));
    return app;
  };
  const get = (app: Hono, ip: string, token?: string, path = "/v1/x") => app.request(path, { headers: { "x-forwarded-for": ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

  it("answers 429 with Retry-After per IP, and per account across IPs", async () => {
    const app = appWith();
    for (let i = 0; i < 3; i++) expect((await get(app, "1.1.1.1")).status).toBe(200);
    const blocked = await get(app, "1.1.1.1");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBe(59);
    expect((await get(app, "2.2.2.2")).status).toBe(200);
    // The same session from two addresses shares one account budget.
    expect((await get(app, "3.3.3.3", "tok")).status).toBe(200);
    expect((await get(app, "4.4.4.4", "tok")).status).toBe(200);
    expect((await get(app, "5.5.5.5", "tok")).status).toBe(429);
    expect((await get(app, "5.5.5.5", "other")).status).toBe(200);
  });

  it("starts a fresh window, fails open when the store breaks, and adds Retry-After to older 429s", async () => {
    let t = 1_000;
    const app = appWith(memoryRateStore(), () => t);
    for (let i = 0; i < 4; i++) await get(app, "1.1.1.1");
    expect((await get(app, "1.1.1.1")).status).toBe(429);
    t += 60_000;
    expect((await get(app, "1.1.1.1")).status).toBe(200);
    const broken = appWith(async () => {
      throw new Error("db down");
    });
    for (let i = 0; i < 6; i++) expect((await get(broken, "1.1.1.1")).status).toBe(200);
    const old = await get(appWith(), "9.9.9.9", undefined, "/v1/busy");
    expect(old.status).toBe(429);
    expect(old.headers.get("Retry-After")).toBe("60");
  });

  it("counts in the database so every instance shares the budget", async () => {
    const db = await seededDb();
    const a = appWith(dbRateStore(db));
    const b = appWith(dbRateStore(db));
    await get(a, "1.1.1.1");
    await get(b, "1.1.1.1");
    await get(a, "1.1.1.1");
    expect((await get(b, "1.1.1.1")).status).toBe(429);
  });

  it("limits sign-up per IP through createApp", async () => {
    const db = await seededDb();
    // Each sign-up a minute apart, so the older per-minute auth limiter in app.ts stays out of the way.
    let t = Date.UTC(2026, 10, 3, 10);
    const app = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => new Date(t), rateStore: memoryRateStore() });
    const register = (n: number) =>
      (t += 60_000) &&
      app.request("/v1/auth/register", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "7.7.7.7" }, body: JSON.stringify({ name: "A", email: `rl${n}@b.co`, password: "pawnpawn" }) });
    for (let i = 0; i < 30; i++) expect((await register(i)).status).toBe(201);
    const res = await register(31);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect((await app.request("/v1/health", { headers: { "x-forwarded-for": "7.7.7.7" } })).status).toBe(200);
  });
});

describe("lifecycle email", () => {
  const SECRET = "test-secret";
  let db: Db;
  let sent: { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }[];
  let now: Date;
  let app: ReturnType<typeof createApp>;
  let ip = 0;
  const sender = {
    email: async (to: string, subject: string, html: string, text: string, headers?: Record<string, string>) => (sent.push({ to, subject, html, text, headers }), true),
    push: async () => true,
  };
  const req = (method: string, path: string, body?: unknown, token?: string, extra: Record<string, string> = {}) =>
    app.request(path, {
      method,
      headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.0.${++ip}`, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const register = async (email: string, extra: Record<string, string> = {}) => ((await (await req("POST", "/v1/auth/register", { name: "Asha Rao", email, password: "pawnpawn" }, undefined, extra)).json()) as AuthResponse);
  const cron = async () => (await req("GET", "/v1/cron/weekly", undefined, undefined, { Authorization: "Bearer cron" })).json();

  beforeEach(async () => {
    db = await seededDb();
    sent = [];
    now = new Date("2026-11-03T10:00:00Z");
    app = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => now, weekly: sender, cronSecret: "cron", emailSecret: SECRET, apiOrigin: "https://api.test" });
  });

  it("signs unsubscribe tokens and rejects tampered ones", () => {
    const t = unsubToken(SECRET, "user-1", "winback");
    expect(readUnsubToken(SECRET, t)).toEqual({ userId: "user-1", kind: "winback" });
    expect(readUnsubToken("other", t)).toBeNull();
    expect(readUnsubToken(SECRET, `${t}x`)).toBeNull();
    expect(readUnsubToken(SECRET, unsubToken(SECRET, "user-1", "all").replace(/^[^.]+/, Buffer.from("user-2.all").toString("base64url")))).toBeNull();
    expect(readUnsubToken(SECRET, "garbage")).toBeNull();
  });

  it("builds branded English and Hindi emails with a plain-text twin and one-click headers", () => {
    const en = welcomeMessage("Asha <Rao>", "en", "https://api.test/u?t=1");
    expect(en.subject).toBe("Welcome to ChessSchool");
    expect(en.html).toContain("Welcome, Asha!");
    expect(en.html).not.toContain("<Rao>");
    expect(en.html).toContain("pwa-192.png");
    expect(en.text).toContain("https://api.test/u?t=1");
    expect(en.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const hi = winbackMessage("चालें", 4, "hi", "https://api.test/u");
    expect(hi.text).toContain("अगला: चालें।");
    expect(hi.html).toContain('lang="hi"');
  });

  it("sends one welcome on sign-up, in the requested language, and never to QA mailboxes", async () => {
    const { user } = await register("asha@b.co", { "x-cs-lang": "hi" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "asha@b.co", subject: "ChessSchool में आपका स्वागत है" });
    expect(sent[0]!.headers?.["List-Unsubscribe"]).toContain("https://api.test/v1/email/unsubscribe?t=");
    const prefs = await db.select().from(emailPrefs).where(eq(emailPrefs.userId, user.id)).get();
    expect(prefs?.lang).toBe("hi");
    // The cron does not send it again.
    expect(await cron()).toMatchObject({ welcome: 0 });
    await register("qa+dev-abcdef1-1@b.co");
    expect(sent).toHaveLength(1);
  });

  it("catches up a welcome the sign-up could not send", async () => {
    let fail = true;
    const flaky = { ...sender, email: async (...a: Parameters<typeof sender.email>) => (fail ? false : sender.email(...a)) };
    app = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => now, weekly: flaky, cronSecret: "cron", emailSecret: SECRET });
    await register("late@b.co");
    expect(sent).toHaveLength(0);
    fail = false;
    expect(await cron()).toMatchObject({ welcome: 1 });
    expect(sent[0]!.to).toBe("late@b.co");
  });

  it("sends nothing lifecycle without EMAIL_SECRET", async () => {
    app = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => now, weekly: sender, cronSecret: "cron" });
    await register("nosecret@b.co");
    expect(sent).toHaveLength(0);
  });

  it("sends a come-back email after a week away, at most once a month, and honours the switch", async () => {
    const { user } = await register("away@b.co");
    sent = [];
    await db.insert(progress).values({ userId: user.id, data: JSON.stringify({}), updatedAt: now.getTime() }).onConflictDoUpdate({ target: progress.userId, set: { updatedAt: now.getTime() } });
    now = new Date(now.getTime() + 3 * DAY);
    expect(await cron()).toMatchObject({ winback: 0 });
    now = new Date(now.getTime() + 5 * DAY);
    expect(await cron()).toMatchObject({ winback: 1 });
    expect(sent[0]!.subject).toBe("Chaukor saved your place");
    now = new Date(now.getTime() + 2 * DAY);
    expect(await cron()).toMatchObject({ winback: 0 });
    // Still away a month later: no second email until they come back and leave again.
    now = new Date(now.getTime() + 31 * DAY);
    expect(await cron()).toMatchObject({ winback: 0 });
    await db.update(progress).set({ updatedAt: now.getTime() }).where(eq(progress.userId, user.id));
    now = new Date(now.getTime() + 8 * DAY);
    // A month on, the first session has expired: sign in again.
    const { token } = (await (await req("POST", "/v1/auth/login", { email: "away@b.co", password: "pawnpawn" })).json()) as AuthResponse;
    expect(await (await req("PUT", "/v1/me/emails", { winback: false }, token)).json()).toEqual({ winback: false });
    expect(await cron()).toMatchObject({ winback: 0 });
    expect(await (await req("PUT", "/v1/me/emails", { winback: true }, token)).json()).toEqual({ winback: true });
    expect(await cron()).toMatchObject({ winback: 1 });
    expect(await (await req("GET", "/v1/me/emails", undefined, token)).json()).toEqual({ winback: true, weekly: false, eligible: true });
  });

  it("never emails guest accounts", async () => {
    const { user } = await register("guest@b.co");
    await db.update(users).set({ kind: "guest" }).where(eq(users.id, user.id));
    await db.insert(progress).values({ userId: user.id, data: "{}", updatedAt: now.getTime() - 8 * DAY }).onConflictDoUpdate({ target: progress.userId, set: { updatedAt: now.getTime() - 8 * DAY } });
    sent = [];
    expect(await cron()).toMatchObject({ winback: 0 });
    expect(sent).toHaveLength(0);
  });

  it("unsubscribes with one POST (from the page or a mail app) and shows a page on GET without changing anything", async () => {
    const { user, token } = await register("unsub@b.co");
    await req("PUT", "/v1/me/weekly", { email: true, lang: "en" }, token);
    const t = encodeURIComponent(unsubToken(SECRET, user.id, "all"));
    const page = await req("GET", `/v1/email/unsubscribe?t=${t}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Stop these emails?");
    expect((await db.query.weeklySummary.findFirst({ where: eq(weeklySummary.userId, user.id) }))?.email).toBe(true);
    const done = await app.request(`/v1/email/unsubscribe?t=${t}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" });
    expect(done.status).toBe(200);
    expect(await done.text()).toContain("unsubscribed</h1>");
    expect(await (await req("GET", "/v1/me/emails", undefined, token)).json()).toMatchObject({ winback: false, weekly: false });
    expect((await req("GET", "/v1/email/unsubscribe?t=bad.token")).status).toBe(400);
  });

  it("puts an unsubscribe link and headers on the weekly summary", async () => {
    const { token } = await register("weekly@b.co");
    sent = [];
    await req("PUT", "/v1/me/weekly", { email: true, lang: "en" }, token);
    now = new Date("2026-11-08T03:30:00Z");
    await cron();
    const weekly = sent.find((m) => m.subject.includes("week on ChessSchool"));
    expect(weekly?.text).toMatch(/Unsubscribe: https:\/\/api\.test\/v1\/email\/unsubscribe\?t=/);
    expect(weekly?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("caps emails per day across every kind", async () => {
    const t = Date.UTC(2026, 10, 3);
    for (let i = 0; i < 3; i++) expect(await takeEmailSlot(db, t, 3)).toBe(true);
    expect(await takeEmailSlot(db, t, 3)).toBe(false);
    expect(await takeEmailSlot(db, t + DAY, 3)).toBe(true);
  });
});
