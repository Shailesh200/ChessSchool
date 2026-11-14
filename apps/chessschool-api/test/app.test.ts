import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { completeNode, createInitialState, PATH, type AuthResponse, type Progress } from "@chessschool/design";
import { createApp } from "../src/app";
import { COURSE, seededDb } from "./course-fixture";
import type { Db } from "../src/db";
import { googleVerifierFromEnv, type GoogleVerifier } from "../src/google";
import { blocks, classGames, classMembers, classes, events, feedback, homework, profiles, progress, reports, sessions, tournaments, users } from "../src/schema";

const NOW = new Date("2026-11-03T10:00:00Z");
let app: ReturnType<typeof createApp>;
let db: Db;
let ip = 0;

const fakeGoogle: GoogleVerifier = async (token) => {
  if (token === "good") return { sub: "g-1", email: "asha@example.com", emailVerified: true, name: "Asha G" };
  if (token === "new") return { sub: "g-2", email: "new@example.com", emailVerified: true, name: "Newbie" };
  if (token === "unverified") return { sub: "g-3", email: "asha@example.com", emailVerified: false, name: "Nope" };
  return null;
};

beforeEach(async () => {
  db = await seededDb();
  app = createApp({ db, google: fakeGoogle, secureCookies: false, corsOrigins: [], now: () => NOW, adminEmails: ["admin@b.co"] });
});

function progressThrough(id: string): Progress {
  const end = PATH.findIndex((n) => n.id === id);
  let state = createInitialState("guest");
  for (const node of PATH.slice(0, end + 1)) state = completeNode(state, node.id, NOW);
  return state.progress;
}

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${++ip}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as any, cookie: res.headers.get("set-cookie") };
}

const guestDone = () => {
  const s = completeNode(createInitialState("guest-123"), "meet", new Date("2026-11-03T09:00:00"));
  return { guestId: s.guestId, profile: { name: "Asha", dailyMinutes: 15 as const, who: "child" as const }, progress: s.progress };
};

describe("course", () => {
  it("marks guestLocked on every lesson: the first three are open for a guest, and none are locked once signed in", async () => {
    const outline = await call("GET", "/v1/course?outline=1");
    expect(outline.status).toBe(200);
    expect(outline.json.guestLimitReached).toBeUndefined();
    expect(outline.json.path).toBeUndefined();
    const guestLessons = outline.json.lessons as { id: string; title: string; steps?: unknown; guestLocked: boolean; lockedReason?: string }[];
    expect(guestLessons.length).toBeGreaterThan(3);
    guestLessons.forEach((lesson, index) => {
      expect(lesson).toHaveProperty("guestLocked");
      expect(lesson.guestLocked).toBe(index >= 3);
      expect(lesson.lockedReason).toBeUndefined();
      expect(lesson.steps).toBeUndefined();
    });
    const centre = guestLessons.find((lesson) => lesson.id === "centre");
    expect(centre?.title).toBe("The centre");
    expect(centre?.guestLocked).toBe(true);
    expect(outline.json.units.length).toBeGreaterThan(3);
    expect(outline.json.comingSoon.length).toBeGreaterThan(0);

    const full = await call("GET", "/v1/course");
    expect(full.json.lessons.find((l: { id: string; steps: unknown[] }) => l.id === "centre").steps.length).toBeGreaterThan(0);
    expect(full.json.lessons.every((l: { guestLocked: boolean }, index: number) => l.guestLocked === index >= 3)).toBe(true);

    const { token } = (await call("POST", "/v1/auth/register", { name: "A", email: "course@b.co", password: "pawnpawn" })).json as AuthResponse;
    const signedIn = await call("GET", "/v1/course?outline=1", undefined, token);
    const memberLessons = signedIn.json.lessons as { guestLocked: boolean }[];
    expect(memberLessons.length).toBe(guestLessons.length);
    memberLessons.forEach((lesson) => {
      expect(lesson).toHaveProperty("guestLocked");
      expect(lesson.guestLocked).toBe(false);
    });

    const one = await call("GET", "/v1/lessons/board");
    expect(one.status).toBe(200);
    expect(one.json.steps.length).toBeGreaterThan(0);
    const capped = await call("GET", "/v1/lessons/centre");
    expect(capped.status).toBe(403);
    expect(capped.json.error).toBe("GUEST_CLASS_LIMIT");
    expect(capped.json.guestLimitReached).toBeUndefined();
    expect((await call("GET", "/v1/lessons/missing")).status).toBe(404);
  });
});

describe("health", () => {
  it("responds", async () => {
    const r = await call("GET", "/v1/health");
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    expect(r.json.app).toBe("0.4.0");
    expect((await call("GET", "/health")).status).toBe(200);
  });
});

describe("register / login / logout", () => {
  it("registers, sets an httpOnly cookie, and keeps guest progress + profile", async () => {
    const r = await call("POST", "/v1/auth/register", { name: "  Asha  ", email: "Asha@Example.com", password: "pawnpawn", guest: guestDone() });
    expect(r.status).toBe(201);
    const a = r.json as AuthResponse;
    expect(a.user).toMatchObject({ email: "asha@example.com", name: "Asha", provider: "password" });
    expect(a.profile).toMatchObject({ dailyMinutes: 15, who: "child" });
    expect(a.progress.completed.meet).toBe("2026-11-03");
    expect(a.progress.xp).toBe(10);
    expect(r.cookie).toMatch(/cs_session=.+HttpOnly/i);

    const me = await call("GET", "/v1/me", undefined, a.token);
    expect(me.status).toBe(200);
    expect(me.json.user.name).toBe("Asha");
  });

  it("validates input with friendly codes", async () => {
    expect((await call("POST", "/v1/auth/register", { name: "", email: "x@y.co", password: "pawnpawn" })).json.error).toBe("invalid_input");
    expect((await call("POST", "/v1/auth/register", { name: "A", email: "nope", password: "pawnpawn" })).json.error).toBe("invalid_input");
    expect((await call("POST", "/v1/auth/register", { name: "A", email: "a@b.co", password: "short" })).json.error).toBe("invalid_input");
  });

  it("refuses duplicate emails", async () => {
    await call("POST", "/v1/auth/register", { name: "A", email: "a@b.co", password: "pawnpawn" });
    const r = await call("POST", "/v1/auth/register", { name: "B", email: "A@b.co", password: "pawnpawn" });
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("email_taken");
  });

  it("logs in, rejects wrong passwords, and logout kills the session", async () => {
    await call("POST", "/v1/auth/register", { name: "A", email: "a@b.co", password: "pawnpawn" });
    expect((await call("POST", "/v1/auth/login", { email: "a@b.co", password: "wrongwrong" })).json.error).toBe("invalid_credentials");
    expect((await call("POST", "/v1/auth/login", { email: "nobody@b.co", password: "pawnpawn" })).json.error).toBe("invalid_credentials");
    const ok = await call("POST", "/v1/auth/login", { email: "a@b.co", password: "pawnpawn" });
    expect(ok.status).toBe(200);
    const token = ok.json.token as string;
    expect((await call("GET", "/v1/me", undefined, token)).status).toBe(200);
    await call("POST", "/v1/auth/logout", undefined, token);
    expect((await call("GET", "/v1/me", undefined, token)).status).toBe(401);
  });

  it("logout revokes only the session that presented the token", async () => {
    await call("POST", "/v1/auth/register", { name: "A", email: "a@b.co", password: "pawnpawn" });
    const first = (await call("POST", "/v1/auth/login", { email: "a@b.co", password: "pawnpawn" })).json as AuthResponse;
    const second = (await call("POST", "/v1/auth/login", { email: "a@b.co", password: "pawnpawn" })).json as AuthResponse;
    expect((await call("POST", "/v1/auth/logout", undefined, first.token)).json).toEqual({ ok: true });
    expect((await call("GET", "/v1/me", undefined, first.token)).status).toBe(401);
    expect((await call("GET", "/v1/me", undefined, second.token)).status).toBe(200);
  });

  it("merges guest progress into an existing account on login", async () => {
    await call("POST", "/v1/auth/register", { name: "A", email: "a@b.co", password: "pawnpawn" });
    const r = await call("POST", "/v1/auth/login", { email: "a@b.co", password: "pawnpawn", guest: guestDone() });
    expect(r.json.progress.completed.meet).toBe("2026-11-03");
    expect(r.json.progress.xp).toBe(10);
  });

  it("rate-limits repeated auth attempts from one address", async () => {
    const headers = { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.9" };
    let last = 0;
    for (let i = 0; i < 14; i++) {
      const res = await app.request("/v1/auth/login", { method: "POST", headers, body: JSON.stringify({ email: "a@b.co", password: "x" }) });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("google", () => {
  it("creates a Google account keeping the guest's chosen name", async () => {
    const r = await call("POST", "/v1/auth/google", { idToken: "new", guest: guestDone() });
    expect(r.status).toBe(200);
    expect(r.json.user).toMatchObject({ email: "new@example.com", name: "Asha", provider: "google" });
    expect(r.json.progress.xp).toBe(10);
  });

  it("does not attach Google to an existing email, verified or not", async () => {
    const registered = (await call("POST", "/v1/auth/register", { name: "Asha", email: "asha@example.com", password: "pawnpawn" })).json as AuthResponse;
    const before = await db.query.users.findFirst({ where: eq(users.id, registered.user.id) });
    const sessionsBefore = await db.select().from(sessions).where(eq(sessions.userId, registered.user.id));
    const verified = await call("POST", "/v1/auth/google", { idToken: "good", guest: guestDone() });
    expect(verified.status).toBe(409);
    expect(verified.json.error).toBe("email_in_use");
    expect(await db.query.users.findFirst({ where: eq(users.id, registered.user.id) })).toEqual(before);
    expect(await db.select().from(sessions).where(eq(sessions.userId, registered.user.id))).toHaveLength(sessionsBefore.length);
    expect(await db.query.progress.findFirst({ where: eq(progress.userId, registered.user.id) })).toBeUndefined();

    const unverified = await call("POST", "/v1/auth/google", { idToken: "unverified" });
    expect(unverified.status).toBe(409);
    expect(unverified.json.error).toBe("email_in_use");
    expect(await db.query.users.findFirst({ where: eq(users.id, registered.user.id) })).toEqual(before);
    expect(await db.query.users.findFirst({ where: eq(users.googleSub, "g-1") })).toBeUndefined();
    expect(await db.query.users.findFirst({ where: eq(users.googleSub, "g-3") })).toBeUndefined();
  });

  it("signs in again when the Google sub already matches", async () => {
    const created = await call("POST", "/v1/auth/google", { idToken: "new" });
    const again = await call("POST", "/v1/auth/google", { idToken: "new" });
    expect(again.status).toBe(200);
    expect((again.json as AuthResponse).user.id).toBe((created.json as AuthResponse).user.id);
    expect((await call("POST", "/v1/auth/login", { email: "new@example.com", password: "whatever1" })).json.error).toBe("google_only");
  });

  it("rejects bad tokens", async () => {
    expect((await call("POST", "/v1/auth/google", { idToken: "forged" })).json.error).toBe("google_invalid");
  });
});

describe("me / home / progress", () => {
  async function account() {
    return (await call("POST", "/v1/auth/register", { name: "A", email: "a@b.co", password: "pawnpawn" })).json as AuthResponse;
  }

  it("requires a session", async () => {
    expect((await call("GET", "/v1/home")).status).toBe(401);
    expect((await call("PUT", "/v1/progress", { progress: {} })).status).toBe(401);
  });

  it("updates profile fields and validates them", async () => {
    const { token } = await account();
    const r = await call("PATCH", "/v1/me", { name: "Asha J", dailyMinutes: 5, appearance: "dark", sound: false }, token);
    expect(r.json.profile).toMatchObject({ name: "Asha J", dailyMinutes: 5, appearance: "dark", sound: false });
    expect((await call("PATCH", "/v1/me", { dailyMinutes: 7 }, token)).status).toBe(400);
    expect((await call("PATCH", "/v1/me", { name: "   " }, token)).status).toBe(400);
  });

  it("returns a personalised home with orientation current, then done", async () => {
    const { token } = await account();
    let home = await call("GET", "/v1/home?day=2026-11-03", undefined, token);
    expect(home.json).toMatchObject({ name: "A", streak: 0, today: { nodeId: "meet", state: "current" } });
    expect(home.json.path).toHaveLength(COURSE.lessons.length);
    expect(home.json.rooms).toEqual([
      { id: "play", open: true },
      { id: "practice", open: true },
      { id: "club", open: false },
    ]);

    await call("PUT", "/v1/progress", { progress: guestDone().progress }, token);
    home = await call("GET", "/v1/home?day=2026-11-04", undefined, token);
    expect(home.json).toMatchObject({ streak: 1, xp: 10, today: { nodeId: "board", state: "current" } });
    expect(home.json.path[0].state).toBe("done");
    expect(home.json.path[1].state).toBe("current");
    expect(home.json.path[2]).toMatchObject({ id: "moves", state: "locked", lockedReason: "progress" });
    expect(home.json.path.filter((n: { state: string }) => n.state === "current")).toHaveLength(1);
  });

  it("unlocks the next class when a lesson is completed, and keeps that state on a repeat upload", async () => {
    const { token } = await account();
    expect((await call("GET", "/v1/lessons/board", undefined, token)).json.error).toBe("lesson_locked");
    const finished = progressThrough("meet");
    const first = await call("PUT", "/v1/progress", { progress: finished }, token);
    expect(first.status).toBe(200);
    expect(first.json.progress.xp).toBe(10);
    expect(first.json.path.find((n: { id: string }) => n.id === "meet").state).toBe("done");
    expect(first.json.path.find((n: { id: string }) => n.id === "board").state).toBe("current");
    expect(first.json.path.find((n: { id: string }) => n.id === "moves").state).toBe("locked");
    expect((await call("GET", "/v1/lessons/board", undefined, token)).status).toBe(200);

    const again = await call("PUT", "/v1/progress", { progress: finished }, token);
    expect(again.status).toBe(200);
    expect(again.json.progress.xp).toBe(10);
    expect(again.json.path.find((n: { id: string }) => n.id === "board").state).toBe("current");
    expect(again.json.path.filter((n: { state: string }) => n.state === "current")).toHaveLength(1);

    const upToDevelop = progressThrough("centre");
    const opened = await call("PUT", "/v1/progress", { progress: upToDevelop }, token);
    expect(opened.json.path.find((n: { id: string }) => n.id === "centre").state).toBe("done");
    expect(opened.json.path.find((n: { id: string }) => n.id === "develop").state).toBe("current");
    expect((await call("GET", "/v1/lessons/develop", undefined, token)).status).toBe(200);
    const repeat = await call("PUT", "/v1/progress", { progress: upToDevelop }, token);
    expect(repeat.json.progress.xp).toBe(opened.json.progress.xp);
    expect(repeat.json.path.find((n: { id: string }) => n.id === "develop").state).toBe("current");
  });

  it("merges progress uploads and refuses inflated or unknown progress", async () => {
    const { token } = await account();
    const p = guestDone().progress;
    const first = await call("PUT", "/v1/progress", { progress: p }, token);
    expect(first.json.progress.xp).toBe(10);
    const hacked = await call("PUT", "/v1/progress", { progress: { ...p, xp: 9999, completed: { ...p.completed, firstGame: "2026-11-03" } } }, token);
    expect(hacked.json.progress.xp).toBe(10);
    expect(hacked.json.progress.completed.firstGame).toBeUndefined();
    const lesson = await call("PUT", "/v1/progress", { progress: { ...p, xp: 9999, completed: { ...p.completed, board: "2026-11-03" }, games: { played: 2, won: 1 } } }, token);
    expect(lesson.json.progress.xp).toBe(30);
    expect(lesson.json.progress.completed.board).toBe("2026-11-03");
    expect(lesson.json.progress.games).toEqual({ played: 2, won: 1 });
    const stale = await call("PUT", "/v1/progress", { progress: { completed: {}, xp: 0, streak: { count: 0, lastDay: null }, minutes: { day: null, value: 0 } } }, token);
    expect(stale.json.progress.completed.meet).toBe("2026-11-03");
    expect((await call("PUT", "/v1/progress", { progress: "junk" }, token)).status).toBe(400);
  });

  it("accepts daily progress without a seen list and caps a long one", async () => {
    const { token } = await account();
    const old = {
      completed: { meet: "2026-11-03" },
      xp: 10,
      streak: { count: 1, lastDay: "2026-11-03" },
      minutes: { day: "2026-11-03", value: 2 },
      puzzles: { rating: 600, attempts: 0, solved: 0, recent: [], sprintBest: 0, daily: { lastDay: "2026-11-03", count: 1 } },
    };
    const put = await call("PUT", "/v1/progress", { progress: old }, token);
    expect(put.status).toBe(200);
    expect(put.json.progress.puzzles.daily.lastDay).toBe("2026-11-03");
    expect(put.json.progress.puzzles.daily.count).toBe(1);
    expect(put.json.progress.puzzles.daily.seen).toEqual([]);

    const ids = Array.from({ length: 400 }, (_, i) => `b${String(i).padStart(4, "0")}`);
    const capped = await call("PUT", "/v1/progress", { progress: { ...old, puzzles: { ...old.puzzles, daily: { ...old.puzzles.daily, seen: ids } } } }, token);
    expect(capped.status).toBe(200);
    expect(capped.json.progress.puzzles.daily.seen).toHaveLength(365);
    expect(capped.json.progress.puzzles.daily.seen[0]).toBe("b0000");
  });
});

describe("guest class cap", () => {
  async function guestAccount() {
    const auth = (await call("POST", "/v1/auth/register", { name: "G", email: "g@b.co", password: "pawnpawn" })).json as AuthResponse;
    await db.update(users).set({ kind: "guest" }).where(eq(users.email, "g@b.co"));
    return auth;
  }

  it("lets a guest start only the first three classes and blocks the fourth", async () => {
    expect((await call("GET", "/v1/lessons/meet")).status).toBe(200);
    expect((await call("GET", "/v1/lessons/board")).status).toBe(200);
    expect((await call("GET", "/v1/lessons/moves")).status).toBe(200);
    const fourth = await call("GET", "/v1/lessons/pawns");
    expect(fourth.status).toBe(403);
    expect(fourth.json.error).toBe("GUEST_CLASS_LIMIT");

    const { token } = await guestAccount();
    const signedInCourse = await call("GET", "/v1/course?outline=1", undefined, token);
    expect((signedInCourse.json.lessons as { guestLocked: boolean }[]).every((lesson) => lesson.guestLocked === false)).toBe(true);
    const three = progressThrough("moves");
    const saved = await call("PUT", "/v1/progress", { progress: three }, token);
    expect(saved.status).toBe(200);
    expect(saved.json.path.find((n: { id: string }) => n.id === "pawns")).toMatchObject({ state: "locked", lockedReason: "guest", playable: false });
    expect((await call("GET", "/v1/lessons/pawns", undefined, token)).json.error).toBe("GUEST_CLASS_LIMIT");

    const four = progressThrough("pawns");
    const blocked = await call("PUT", "/v1/progress", { progress: four }, token);
    expect(blocked.status).toBe(403);
    expect(blocked.json.error).toBe("GUEST_CLASS_LIMIT");
    const home = await call("GET", "/v1/home", undefined, token);
    expect(home.json.path.find((n: { id: string }) => n.id === "pawns").state).toBe("locked");
    expect(home.json.xp).toBe(saved.json.progress.xp);

    const replay = await call("PUT", "/v1/progress", { progress: three }, token);
    expect(replay.status).toBe(200);
    expect(replay.json.progress.completed.pawns).toBeUndefined();
    expect(replay.json.path.find((n: { id: string }) => n.id === "moves").state).toBe("done");
  });

  it("does not cap a signed-in member", async () => {
    const { token } = (await call("POST", "/v1/auth/register", { name: "M", email: "m@b.co", password: "pawnpawn" })).json as AuthResponse;
    const saved = await call("PUT", "/v1/progress", { progress: progressThrough("pawns") }, token);
    expect(saved.status).toBe(200);
    expect(saved.json.path.find((n: { id: string }) => n.id === "pawns").state).toBe("done");
    expect(saved.json.path.find((n: { id: string }) => n.id === "check").state).toBe("current");
  });
});

describe("google configuration", () => {
  it("returns 503 when GOOGLE_CLIENT_IDS is unset, blank, or only commas", async () => {
    for (const raw of [undefined, "", "   ", " , , ", ",,"]) {
      expect(googleVerifierFromEnv({ GOOGLE_CLIENT_IDS: raw })).toBeNull();
    }
    const bare = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => NOW });
    const res = await bare.request("/v1/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "8.8.8.8" },
      body: JSON.stringify({ idToken: "anything" }),
    });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe("google_unconfigured");
  });
});

describe("account deletion and feedback", () => {
  it("turns foreign keys on for this connection", async () => {
    const result = await db.$client.execute("PRAGMA foreign_keys");
    const row = result.rows[0] as Record<string, unknown> | undefined;
    const value = row?.foreign_keys ?? Object.values(row ?? {})[0];
    expect(Number(value)).toBe(1);
  });

  it("allows a cross-origin DELETE preflight", async () => {
    const corsApp = createApp({ db, google: null, secureCookies: false, corsOrigins: ["https://chess-school.in"], now: () => NOW });
    const res = await corsApp.request("/v1/me", {
      method: "OPTIONS",
      headers: {
        Origin: "https://chess-school.in",
        "Access-Control-Request-Method": "DELETE",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods") ?? "").toMatch(/DELETE/);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://chess-school.in");
  });

  it("deletes the account, every session, and every per-user row", async () => {
    const owner = (await call("POST", "/v1/auth/register", { name: "D", email: "d@b.co", password: "pawnpawn" })).json as AuthResponse;
    const other = (await call("POST", "/v1/auth/register", { name: "E", email: "e@b.co", password: "pawnpawn" })).json as AuthResponse;
    const second = (await call("POST", "/v1/auth/login", { email: "d@b.co", password: "pawnpawn" })).json as AuthResponse;
    await call("PUT", "/v1/progress", { progress: guestDone().progress }, owner.token);
    const made = await call("POST", "/v1/classes", { name: "Tuesday" }, owner.token);
    expect(made.status).toBe(201);
    const note = await call("POST", "/v1/feedback", { mood: "ok", message: "Please delete this too" }, owner.token);
    expect(note.status).toBe(200);

    const removed = await call("DELETE", "/v1/me", undefined, owner.token);
    expect(removed.status).toBe(200);
    expect(removed.json).toEqual({ ok: true });
    expect((await call("GET", "/v1/me", undefined, owner.token)).json.error).toBe("unauthorized");
    expect((await call("GET", "/v1/me", undefined, second.token)).status).toBe(401);
    expect((await call("DELETE", "/v1/me", undefined, owner.token)).status).toBe(401);
    expect((await call("GET", "/v1/join/" + made.json.class.code)).status).toBe(404);

    const id = owner.user.id;
    expect(await db.select().from(users).where(eq(users.id, id))).toEqual([]);
    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toEqual([]);
    expect(await db.select().from(progress).where(eq(progress.userId, id))).toEqual([]);
    expect(await db.select().from(profiles).where(eq(profiles.userId, id))).toEqual([]);
    expect(await db.select().from(feedback).where(eq(feedback.userId, id))).toEqual([]);
    expect(await db.select().from(classMembers).where(eq(classMembers.userId, id))).toEqual([]);
    expect(await db.select().from(classes).where(eq(classes.ownerId, id))).toEqual([]);
    expect((await call("GET", "/v1/me", undefined, other.token)).status).toBe(200);
  });

  it("accepts feedback from guests, validates it and rate limits", async () => {
    const ok = await call("POST", "/v1/feedback", { mood: "love", message: "Great lessons!", guestId: "g1", context: { platform: "web" } });
    expect(ok.status).toBe(200);
    expect((await call("POST", "/v1/feedback", { mood: "love", message: "" })).status).toBe(400);
    expect((await call("POST", "/v1/feedback", { mood: "angry", message: "hello there" })).status).toBe(400);
    const same = () => app.request("/v1/feedback", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify({ mood: "ok", message: "again and again" }) });
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await same()).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

describe("classes", () => {
  it("lets a monitor create a class and a classmate join with the code", async () => {
    const owner = (await call("POST", "/v1/auth/register", { name: "Monitor", email: "mon@b.co", password: "pawnpawn" })).json as AuthResponse;
    const made = await call("POST", "/v1/classes", { name: "Tuesday club" }, owner.token);
    expect(made.status).toBe(201);
    expect(made.json.class.role).toBe("monitor");
    expect(made.json.class.code).toMatch(/^[A-Z0-9]{6}$/);
    const mate = (await call("POST", "/v1/auth/register", { name: "Asha", email: "asha2@b.co", password: "pawnpawn" })).json as AuthResponse;
    const joined = await call("POST", "/v1/classes/join", { code: made.json.class.code }, mate.token);
    expect(joined.status).toBe(200);
    expect(joined.json.class.members).toHaveLength(2);
    expect(joined.json.class.role).toBe("student");
    expect((await call("POST", "/v1/classes/join", { code: "NOPE00" }, mate.token)).status).toBe(404);
  });
});

describe("class safety", () => {
  const reg = async (name: string, email: string) => (await call("POST", "/v1/auth/register", { name, email, password: "pawnpawn" })).json as AuthResponse;
  async function trio() {
    const mon = await reg("Monitor", "m@s.co");
    const asha = await reg("Asha", "a@s.co");
    const ravi = await reg("Ravi", "r@s.co");
    const room = (await call("POST", "/v1/classes", { name: "Club" }, mon.token)).json.class;
    await call("POST", "/v1/classes/join", { code: room.code }, asha.token);
    await call("POST", "/v1/classes/join", { code: room.code }, ravi.token);
    return { mon, asha, ravi, room };
  }
  const members = async (token: string) => (await call("GET", "/v1/classes", undefined, token)).json.classes[0].members as { id: string; name: string; lessons: number; xp: number; avatar: string; joinedAt: number; streak: { count: number } }[];

  it("shows each member's card stats from saved progress", async () => {
    const { mon, asha } = await trio();
    await call("PUT", "/v1/progress", { progress: guestDone().progress }, asha.token);
    const list = await members(mon.token);
    const a = list.find((m) => m.name === "Asha")!;
    expect(a.lessons).toBe(1);
    expect(a.xp).toBeGreaterThan(0);
    expect(a.streak.count).toBe(1);
    expect(a.avatar).toBe("cody");
    expect(a.joinedAt).toBe(NOW.getTime());
    expect(list.find((m) => m.name === "Ravi")!.lessons).toBe(0);
  });

  it("reports a member, blocks them by default and hides them from the reporter only", async () => {
    const { mon, asha, ravi, room } = await trio();
    const res = await call("POST", `/v1/classes/${room.id}/members/${ravi.user.id}/report`, { reason: "name", note: "  rude name " }, asha.token);
    expect(res.status).toBe(200);
    const [row] = await db.select().from(reports);
    expect(row).toMatchObject({ reporterId: asha.user.id, reportedId: ravi.user.id, reason: "name", note: "rude name", status: "open" });
    expect((await members(asha.token)).map((m) => m.name).sort()).toEqual(["Asha", "Monitor"]);
    expect(await members(mon.token)).toHaveLength(3);
  });

  it("reports without blocking when asked, and rejects bad reasons, self reports and strangers", async () => {
    const { asha, ravi, room } = await trio();
    expect((await call("POST", `/v1/classes/${room.id}/members/${ravi.user.id}/report`, { reason: "behaviour", block: false }, asha.token)).status).toBe(200);
    expect(await db.select().from(blocks)).toEqual([]);
    expect(await members(asha.token)).toHaveLength(3);
    expect((await call("POST", `/v1/classes/${room.id}/members/${ravi.user.id}/report`, { reason: "mean" }, asha.token)).status).toBe(400);
    expect((await call("POST", `/v1/classes/${room.id}/members/${asha.user.id}/report`, { reason: "other" }, asha.token)).status).toBe(400);
    const stranger = await reg("Zed", "z@s.co");
    expect((await call("POST", `/v1/classes/${room.id}/members/${ravi.user.id}/report`, { reason: "other" }, stranger.token)).status).toBe(404);
  });

  it("blocks a member, and only the monitor can remove one", async () => {
    const { mon, asha, ravi, room } = await trio();
    expect((await call("POST", `/v1/classes/${room.id}/members/${ravi.user.id}/block`, {}, asha.token)).status).toBe(200);
    expect((await members(asha.token)).some((m) => m.id === ravi.user.id)).toBe(false);
    const denied = await call("DELETE", `/v1/classes/${room.id}/members/${ravi.user.id}`, undefined, asha.token);
    expect(denied.status).toBe(403);
    expect(denied.json.error).toBe("forbidden");
    expect((await call("DELETE", `/v1/classes/${room.id}/members/${ravi.user.id}`, undefined, mon.token)).status).toBe(200);
    expect((await call("GET", "/v1/classes", undefined, ravi.token)).json.classes).toEqual([]);
  });

  it("clears reports and blocks when either account is deleted", async () => {
    const { asha, ravi, room } = await trio();
    await call("POST", `/v1/classes/${room.id}/members/${ravi.user.id}/report`, { reason: "name" }, asha.token);
    expect((await call("DELETE", "/v1/me", undefined, ravi.token)).status).toBe(200);
    expect(await db.select().from(reports)).toEqual([]);
    expect(await db.select().from(blocks)).toEqual([]);
  });
});

describe("usage events and admin", () => {
  const batch = (over: Record<string, unknown> = {}) => ({
    install: "inst_1",
    platform: "ios",
    appVersion: "0.4.0",
    events: [
      { name: "lesson_start", at: NOW.getTime() - 1000, lesson: "meet" },
      { name: "lesson_quit", at: NOW.getTime() - 500, lesson: "meet", step: 3 },
      { name: "made_up", at: NOW.getTime() },
      { name: "app_open", at: NOW.getTime() - 30 * 86_400_000 },
    ],
    ...over,
  });

  it("stores valid events without an account and drops bad ones", async () => {
    const res = await call("POST", "/v1/events", batch());
    expect(res.status).toBe(200);
    expect(res.json.stored).toBe(2);
    const rows = await db.select().from(events);
    expect(rows.map((r) => r.name).sort()).toEqual(["lesson_quit", "lesson_start"]);
    expect((await call("POST", "/v1/events", batch({ install: "bad id!" }))).status).toBe(400);
    expect((await call("POST", "/v1/events", batch({ platform: "tv" }))).status).toBe(400);
  });

  it("lets only admin emails read usage and reports, and resolve a report", async () => {
    await call("POST", "/v1/events", batch());
    await call("POST", "/v1/events", batch({ install: "inst_2", events: [{ name: "lesson_start", at: NOW.getTime() - 100, lesson: "meet" }, { name: "lesson_finish", at: NOW.getTime() - 50, lesson: "meet" }] }));
    const admin = (await call("POST", "/v1/auth/register", { name: "Admin", email: "admin@b.co", password: "pawnpawn" })).json as AuthResponse;
    const user = (await call("POST", "/v1/auth/register", { name: "U", email: "u@b.co", password: "pawnpawn" })).json as AuthResponse;
    expect((await call("GET", "/v1/admin/usage")).status).toBe(401);
    expect((await call("GET", "/v1/admin/usage", undefined, user.token)).status).toBe(403);
    const usage = await call("GET", "/v1/admin/usage?days=7", undefined, admin.token);
    expect(usage.status).toBe(200);
    expect(usage.json.installs).toBe(2);
    expect(usage.json.lessons).toEqual([{ lesson: "meet", starts: 2, finishes: 1, quits: 1, completion: 50, topQuitStep: 3 }]);

    const mate = (await call("POST", "/v1/auth/register", { name: "Mate", email: "mate@b.co", password: "pawnpawn" })).json as AuthResponse;
    const room = (await call("POST", "/v1/classes", { name: "Club" }, user.token)).json.class;
    await call("POST", "/v1/classes/join", { code: room.code }, mate.token);
    await call("POST", `/v1/classes/${room.id}/members/${mate.user.id}/report`, { reason: "behaviour" }, user.token);
    const list = await call("GET", "/v1/admin/reports", undefined, admin.token);
    expect(list.status).toBe(200);
    expect(list.json.reports).toHaveLength(1);
    expect(list.json.reports[0]).toMatchObject({ reason: "behaviour", reported: "Mate", reporter: "U", className: "Club", status: "open" });
    const id = list.json.reports[0].id;
    expect((await call("PATCH", `/v1/admin/reports/${id}`, { status: "resolved" }, admin.token)).status).toBe(200);
    expect((await call("PATCH", `/v1/admin/reports/${id}`, { status: "maybe" }, admin.token)).status).toBe(400);
    expect((await call("PATCH", `/v1/admin/reports/${id}`, { status: "resolved" }, user.token)).status).toBe(403);
    const [row] = await db.select().from(reports);
    expect(row.status).toBe("resolved");
  });
});

describe("practice", () => {
  const lessonOf = (ref: string) => ref.split(":")[0];

  it("serves due reviews first, then steps only from lessons the caller can open", async () => {
    const { token } = (await call("POST", "/v1/auth/register", { name: "P", email: "p@b.co", password: "pawnpawn" })).json as AuthResponse;
    await call("PUT", "/v1/progress", { progress: progressThrough("moves") }, token);
    const board = COURSE.lessons.find((l) => l.id === "board")!;
    const reviewIdx = board.steps.findIndex((s) => s.kind !== "say");
    const res = await call("POST", "/v1/practice", { lessons: ["board", "moves", "castling"], review: [`board:${reviewIdx}`, "board:0"], count: 6 }, token);
    expect(res.status).toBe(200);
    const items = res.json.items as { ref: string; step: { kind: string } }[];
    expect(items[0].ref).toBe(`board:${reviewIdx}`);
    expect(items.some((i) => i.ref === "board:0")).toBe(board.steps[0].kind !== "say");
    expect(items.length).toBe(6);
    expect(new Set(items.map((i) => i.ref)).size).toBe(6);
    expect(items.every((i) => i.step.kind !== "say")).toBe(true);
    expect(items.some((i) => lessonOf(i.ref) === "castling")).toBe(false);
  });

  it("gives a guest nothing from lessons past the free ones and caps the count", async () => {
    const late = COURSE.lessons[10].id;
    const guest = await call("POST", "/v1/practice", { lessons: [late] });
    expect(guest.json.items).toEqual([]);
    const free = await call("POST", "/v1/practice", { lessons: ["board", "moves"], count: 99 });
    expect(free.json.items.length).toBeLessThanOrEqual(10);
    expect(free.json.items.every((i: { ref: string }) => ["board", "moves"].includes(lessonOf(i.ref)))).toBe(true);
    expect((await call("POST", "/v1/practice", { lessons: "nope" })).json.items).toEqual([]);
  });
});

describe("coach voice", () => {
  it("serves a coach's clips for one lesson's lines and the fixed phrases, nothing for unrecorded coaches", async () => {
    const { applyVoice } = await import("../src/voice");
    const { voiceKey } = await import("@chessschool/design");
    const board = COURSE.lessons.find((l) => l.id === "board")!;
    const line = board.steps[0].body;
    const other = COURSE.lessons.find((l) => l.id === "castling")!.steps[0].body;
    await applyVoice(db, [{ coach: "meera", clips: { [voiceKey(line)]: "https://cdn/1.mp3", [voiceKey("Nice!")]: "https://cdn/2.mp3", [voiceKey(other)]: "https://cdn/3.mp3" } }]);
    const res = await call("GET", "/v1/voice/meera/board");
    expect(res.status).toBe(200);
    expect(res.json.clips).toEqual({ [voiceKey(line)]: "https://cdn/1.mp3", [voiceKey("Nice!")]: "https://cdn/2.mp3" });
    expect((await call("GET", "/v1/voice/tara/board")).json.clips).toEqual({});
    expect((await call("GET", "/v1/voice/nobody/board")).status).toBe(404);
    expect((await call("GET", "/v1/voice/meera/nope")).status).toBe(404);
    await applyVoice(db, [{ coach: "meera", clips: { [voiceKey("Nice!")]: "https://cdn/4.mp3" } }]);
    expect((await call("GET", "/v1/voice/meera/board")).json.clips).toEqual({ [voiceKey("Nice!")]: "https://cdn/4.mp3" });
  });
});

describe("course translations", () => {
  it("serves translated words line by line with English fallback, and keeps the chess", async () => {
    const { applyCourseText } = await import("../src/course-text");
    const board = COURSE.lessons.find((l) => l.id === "board")!;
    await applyCourseText(db, { lang: "hi", units: { [board.unit]: { title: "यूनिट" } }, lessons: { board: { title: "बोर्ड", steps: [{ body: "यह बोर्ड है।" }] } } });
    const hi = (await call("GET", "/v1/lessons/board?lang=hi")).json;
    expect(hi.title).toBe("बोर्ड");
    expect(hi.steps[0].body).toBe("यह बोर्ड है।");
    expect(hi.steps[0].title).toBe(board.steps[0].title);
    expect(hi.steps[1].body).toBe(board.steps[1].body);
    expect(hi.steps.map((s: { kind: string; fen?: string }) => [s.kind, s.fen])).toEqual(board.steps.map((s) => [s.kind, (s as { fen?: string }).fen]));
    expect((await call("GET", "/v1/lessons/board")).json.title).toBe(board.title);
    expect((await call("GET", "/v1/lessons/board?lang=xx")).json.title).toBe(board.title);
    const outline = (await call("GET", "/v1/course?outline=1&lang=hi")).json;
    expect(outline.units.find((u: { id: string }) => u.id === board.unit).title).toBe("यूनिट");
  });

  it("rejects a translation that does not line up with the English course", async () => {
    const { checkCourseText } = await import("../src/course-text");
    const board = COURSE.lessons.find((l) => l.id === "board")!;
    expect(checkCourseText(COURSE, { lang: "hi", units: {}, lessons: { board: { steps: [{}] } } })[0]).toMatch(/steps/);
    expect(checkCourseText(COURSE, { lang: "hi", units: { nope: {} }, lessons: { ghost: {} } })).toHaveLength(2);
    const choice = board.steps.findIndex((s) => s.kind === "choice");
    const steps = board.steps.map((_, i) => (i === choice ? { options: ["एक"] } : {}));
    expect(checkCourseText(COURSE, { lang: "hi", units: {}, lessons: { board: { steps } } })[0]).toMatch(/options/);
  });

  it("the shipped Hindi translation lines up with the course", async () => {
    const { checkCourseText, readCourseTexts } = await import("../src/course-text");
    const { DEFAULT_COURSE_FILE } = await import("../scripts/seed-course");
    const { dirname } = await import("node:path");
    const texts = readCourseTexts(dirname(DEFAULT_COURSE_FILE));
    expect(texts.map((t) => t.lang)).toContain("hi");
    for (const t of texts) expect(checkCourseText(COURSE, t)).toEqual([]);
  });
});

describe("class leaderboard", () => {
  it("ranks this week's lessons, honours hiding, and ignores placed and older lessons", async () => {
    const reg = async (name: string, email: string) => (await call("POST", "/v1/auth/register", { name, email, password: "pawnpawn" })).json as AuthResponse;
    const mon = await reg("Mon", "lb1@b.co");
    const kid = await reg("Kid", "lb2@b.co");
    const room = (await call("POST", "/v1/classes", { name: "Club" }, mon.token)).json.class;
    await call("POST", "/v1/classes/join", { code: room.code }, kid.token);
    const p = progressThrough("moves");
    await call("PUT", "/v1/progress", { progress: { ...p, completed: { ...p.completed, meet: "2026-10-01" } } }, kid.token);
    const lb = await call("GET", `/v1/classes/${room.id}/leaderboard?day=2026-11-04`, undefined, mon.token);
    expect(lb.status).toBe(200);
    expect(lb.json.week).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(lb.json.entries.map((e: { name: string; lessons: number }) => [e.name, e.lessons])).toEqual([["Kid", 2], ["Mon", 0]]);
    expect((await call("GET", `/v1/classes/${room.id}/leaderboard?day=2026-11-20`, undefined, mon.token)).json.entries[0].lessons).toBe(0);
    expect((await call("PUT", "/v1/me/leaderboard", { hidden: true }, kid.token)).status).toBe(200);
    const after = await call("GET", `/v1/classes/${room.id}/leaderboard?day=2026-11-04`, undefined, kid.token);
    expect(after.json.hidden).toBe(true);
    expect(after.json.entries.map((e: { name: string }) => e.name)).toEqual(["Mon"]);
    const stranger = await reg("Zed", "lb3@b.co");
    expect((await call("GET", `/v1/classes/${room.id}/leaderboard`, undefined, stranger.token)).status).toBe(404);
  });
});

describe("placement quiz", () => {
  it("serves eight playable positions in course order, to guests too", async () => {
    const res = await call("GET", "/v1/placement");
    expect(res.status).toBe(200);
    const items = res.json.items as { lesson: string; step: { kind: string } }[];
    expect(items).toHaveLength(8);
    expect(items.every((i) => i.step.kind !== "say" && i.step.kind !== "game")).toBe(true);
    const order = COURSE.lessons.map((l) => l.id);
    const idx = items.map((i) => order.indexOf(i.lesson));
    expect(idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1]))).toBe(true);
  });
});

describe("offline lessons", () => {
  it("lets a signed-in learner fetch up to 10 locked lessons ahead with offline=1, not further, and never a guest", async () => {
    const { token } = (await call("POST", "/v1/auth/register", { name: "O", email: "off@b.co", password: "pawnpawn" })).json as AuthResponse;
    await call("PUT", "/v1/progress", { progress: progressThrough("moves") }, token);
    const order = COURSE.lessons.map((l) => l.id);
    const at = order.indexOf("moves");
    const near = order[at + 3];
    const far = order[at + 15];
    expect((await call("GET", `/v1/lessons/${near}`, undefined, token)).status).toBe(403);
    expect((await call("GET", `/v1/lessons/${near}?offline=1`, undefined, token)).status).toBe(200);
    expect((await call("GET", `/v1/lessons/${far}?offline=1`, undefined, token)).status).toBe(403);
    expect((await call("GET", `/v1/lessons/${order[8]}?offline=1`)).status).toBe(403);
  });
});

describe("endgame tablebase", () => {
  it("answers from the tablebase once, then from the cache; rejects big or bad positions", async () => {
    const asked: string[] = [];
    const local = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => NOW, tablebase: async (fen) => (asked.push(fen), { move: "e5e6", category: "loss" }) });
    const get = (fen: string) => local.request(`/v1/tablebase?fen=${encodeURIComponent(fen)}`);
    const fen = "8/8/3k4/8/4K3/8/8/3Q4 b - - 3 40";
    const a = await (await get(fen)).json();
    expect(a).toEqual({ move: "e5e6", category: "loss" });
    await get("8/8/3k4/8/4K3/8/8/3Q4 b - - 0 1");
    expect(asked).toEqual(["8/8/3k4/8/4K3/8/8/3Q4 b - - 0 1"]);
    expect((await get("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).status).toBe(400);
    expect((await get("not a fen")).status).toBe(400);
    const down = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => NOW, tablebase: async () => null });
    expect((await down.request(`/v1/tablebase?fen=${encodeURIComponent("8/8/8/4k3/8/8/8/R3K3 b - - 0 1")}`)).status).toBe(503);
  });
});

describe("class homework, games and tournaments", () => {
  const reg = async (name: string, email: string) => (await call("POST", "/v1/auth/register", { name, email, password: "pawnpawn" })).json as AuthResponse;
  async function club(n = 2) {
    const mon = await reg("Mon", "hw-mon@b.co");
    const kids: AuthResponse[] = [];
    for (let i = 0; i < n; i++) kids.push(await reg(`Kid${i}`, `hw-kid${i}@b.co`));
    const room = (await call("POST", "/v1/classes", { name: "Club" }, mon.token)).json.class;
    for (const k of kids) await call("POST", "/v1/classes/join", { code: room.code }, k.token);
    return { mon, kids, room };
  }
  const order = COURSE.lessons.map((l) => l.id);

  it("lets the monitor set and delete homework, and shows who finished from saved progress", async () => {
    const { mon, kids, room } = await club(2);
    const stranger = await reg("Zed", "hw-z@b.co");
    const lessons = [order[1], order[2]];
    expect((await call("POST", `/v1/classes/${room.id}/homework`, { lessons, due: "2026-11-10" }, kids[0].token)).status).toBe(403);
    expect((await call("POST", `/v1/classes/${room.id}/homework`, { lessons, due: "2026-11-10" }, stranger.token)).status).toBe(404);
    expect((await call("POST", `/v1/classes/${room.id}/homework`, { lessons: ["nope"], due: "2026-11-10" }, mon.token)).status).toBe(400);
    expect((await call("POST", `/v1/classes/${room.id}/homework`, { lessons, due: "next week" }, mon.token)).status).toBe(400);
    expect((await call("POST", `/v1/classes/${room.id}/homework`, { lessons: [], due: "2026-11-10" }, mon.token)).status).toBe(400);
    const made = await call("POST", `/v1/classes/${room.id}/homework`, { lessons, due: "2026-11-10" }, mon.token);
    expect(made.status).toBe(201);
    expect(made.json.homework).toMatchObject({ lessons, due: "2026-11-10" });
    expect(made.json.homework.members.map((m: { name: string; done: boolean }) => [m.name, m.done])).toEqual([["Kid0", false], ["Kid1", false]]);

    await call("PUT", "/v1/progress", { progress: progressThrough(order[2]) }, kids[0].token);
    const seen = await call("GET", `/v1/classes/${room.id}/homework`, undefined, kids[1].token);
    expect(seen.status).toBe(200);
    expect(seen.json.homework[0].members.map((m: { name: string; done: boolean }) => [m.name, m.done])).toEqual([["Kid0", true], ["Kid1", false]]);
    expect((await call("GET", `/v1/classes/${room.id}/homework`, undefined, stranger.token)).status).toBe(404);

    const id = made.json.homework.id;
    expect((await call("DELETE", `/v1/classes/${room.id}/homework/${id}`, undefined, kids[0].token)).status).toBe(403);
    expect((await call("DELETE", `/v1/classes/${room.id}/homework/${id}`, undefined, mon.token)).status).toBe(200);
    expect((await call("DELETE", `/v1/classes/${room.id}/homework/${id}`, undefined, mon.token)).status).toBe(404);
    expect((await call("GET", `/v1/classes/${room.id}/homework`, undefined, mon.token)).json.homework).toEqual([]);
  });

  it("plays a turn-based game to checkmate with legality and turn checks", async () => {
    const { mon, kids, room } = await club(2);
    const [a, b] = kids;
    const stranger = await reg("Zed", "g-z@b.co");
    expect((await call("POST", `/v1/classes/${room.id}/games`, { opponentId: b.user.id, color: "w" }, stranger.token)).status).toBe(404);
    expect((await call("POST", `/v1/classes/${room.id}/games`, { opponentId: a.user.id, color: "w" }, a.token)).status).toBe(400);
    const made = await call("POST", `/v1/classes/${room.id}/games`, { opponentId: b.user.id, color: "w" }, a.token);
    expect(made.status).toBe(201);
    const game = made.json.game;
    expect(game).toMatchObject({ white: { id: a.user.id, name: "Kid0" }, black: { id: b.user.id }, you: "w", yourTurn: true, status: "active", moves: [] });
    const move = (token: string, from: string, to: string) => call("POST", `/v1/classes/${room.id}/games/${game.id}/moves`, { from, to }, token);

    expect((await move(b.token, "e7", "e5")).status).toBe(409);
    expect((await move(a.token, "e2", "e5")).status).toBe(400);
    expect((await move(mon.token, "e2", "e4")).status).toBe(403);
    expect((await move(stranger.token, "e2", "e4")).status).toBe(404);
    expect((await move(a.token, "f2", "f3")).status).toBe(200);
    expect((await move(a.token, "e2", "e4")).status).toBe(409);

    const list = await call("GET", `/v1/classes/${room.id}/games`, undefined, b.token);
    expect(list.json.games).toHaveLength(1);
    expect(list.json.games[0].yourTurn).toBe(true);
    expect((await call("GET", `/v1/classes/${room.id}/games`, undefined, mon.token)).json.games).toEqual([]);

    await move(b.token, "e7", "e5");
    await move(a.token, "g2", "g4");
    const mate = await move(b.token, "d8", "h4");
    expect(mate.status).toBe(200);
    expect(mate.json.game).toMatchObject({ status: "over", result: "0-1", reason: "checkmate", moves: ["f3", "e5", "g4", "Qh4#"], yourTurn: false });
    expect((await move(a.token, "e2", "e4")).status).toBe(409);
    expect((await call("POST", `/v1/classes/${room.id}/games/${game.id}/resign`, {}, a.token)).status).toBe(409);
    const watched = await call("GET", `/v1/classes/${room.id}/games/${game.id}`, undefined, mon.token);
    expect(watched.json.game).toMatchObject({ you: null, result: "0-1" });
    expect((await call("GET", `/v1/classes/${room.id}/games/${game.id}`, undefined, stranger.token)).status).toBe(404);
  });

  it("resigns, and refuses challenges and moves between blocked classmates", async () => {
    const { kids, room } = await club(2);
    const [a, b] = kids;
    const game = (await call("POST", `/v1/classes/${room.id}/games`, { opponentId: b.user.id, color: "b" }, a.token)).json.game;
    expect(game.white.id).toBe(b.user.id);
    const resigned = await call("POST", `/v1/classes/${room.id}/games/${game.id}/resign`, {}, a.token);
    expect(resigned.json.game).toMatchObject({ status: "over", result: "1-0", reason: "resign" });

    const open = (await call("POST", `/v1/classes/${room.id}/games`, { opponentId: a.user.id, color: "w" }, b.token)).json.game;
    await call("POST", `/v1/classes/${room.id}/members/${a.user.id}/block`, {}, b.token);
    expect((await call("POST", `/v1/classes/${room.id}/games`, { opponentId: b.user.id, color: "w" }, a.token)).status).toBe(403);
    expect((await call("POST", `/v1/classes/${room.id}/games`, { opponentId: a.user.id, color: "w" }, b.token)).status).toBe(403);
    expect((await call("POST", `/v1/classes/${room.id}/games/${open.id}/moves`, { from: "e2", to: "e4" }, b.token)).status).toBe(403);
  });

  it("rate limits challenges", async () => {
    const { kids, room } = await club(2);
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await call("POST", `/v1/classes/${room.id}/games`, { opponentId: kids[1].user.id, color: "w" }, kids[0].token)).status);
    expect(statuses.slice(0, 30).every((s) => s === 201)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it("runs a round robin with standings, skipping blocked pairs", async () => {
    const { mon, kids, room } = await club(4);
    const ids = kids.map((k) => k.user.id);
    expect((await call("POST", `/v1/classes/${room.id}/tournaments`, { players: ids.slice(0, 3) }, kids[0].token)).status).toBe(403);
    expect((await call("POST", `/v1/classes/${room.id}/tournaments`, { players: ids.slice(0, 2) }, mon.token)).status).toBe(400);
    expect((await call("POST", `/v1/classes/${room.id}/tournaments`, { players: [...ids.slice(0, 2), "someone"] }, mon.token)).status).toBe(400);

    const made = await call("POST", `/v1/classes/${room.id}/tournaments`, { players: ids }, mon.token);
    expect(made.status).toBe(201);
    expect(made.json.tournament).toMatchObject({ done: 0, total: 6 });
    expect(made.json.tournament.standings).toHaveLength(4);

    const games = (await call("GET", `/v1/classes/${room.id}/games`, undefined, kids[0].token)).json.games as { id: string; white: { id: string }; black: { id: string }; tournamentId: string }[];
    expect(games).toHaveLength(3);
    expect(games.every((g) => g.tournamentId === made.json.tournament.id)).toBe(true);
    // Kid0 resigns one game and the other side of another resigns to Kid0.
    await call("POST", `/v1/classes/${room.id}/games/${games[0].id}/resign`, {}, kids[0].token);
    const g1 = games[1];
    const other = kids.find((k) => k.user.id === (g1.white.id === ids[0] ? g1.black.id : g1.white.id))!;
    await call("POST", `/v1/classes/${room.id}/games/${g1.id}/resign`, {}, other.token);
    const list = (await call("GET", `/v1/classes/${room.id}/tournaments`, undefined, kids[3].token)).json.tournaments;
    expect(list[0]).toMatchObject({ done: 2, total: 6 });
    const row = list[0].standings.find((s: { id: string }) => s.id === ids[0]);
    expect(row).toMatchObject({ points: 1, played: 2 });
    expect(list[0].standings[0].points).toBe(1);

    await call("POST", `/v1/classes/${room.id}/members/${ids[1]}/block`, {}, kids[0].token);
    const second = await call("POST", `/v1/classes/${room.id}/tournaments`, { players: ids }, mon.token);
    expect(second.json.tournament.total).toBe(5);
  });

  it("deletes a member's games, and a closed class's homework, games and tournaments", async () => {
    const { mon, kids, room } = await club(3);
    await call("POST", `/v1/classes/${room.id}/homework`, { lessons: [order[1]], due: "2026-11-10" }, mon.token);
    await call("POST", `/v1/classes/${room.id}/tournaments`, { players: kids.map((k) => k.user.id) }, mon.token);
    expect(await db.select().from(classGames)).toHaveLength(3);
    expect((await call("DELETE", "/v1/me", undefined, kids[0].token)).status).toBe(200);
    const left = await db.select().from(classGames);
    expect(left).toHaveLength(1);
    expect(left.every((g) => g.whiteId !== kids[0].user.id && g.blackId !== kids[0].user.id)).toBe(true);
    expect((await call("DELETE", "/v1/me", undefined, mon.token)).status).toBe(200);
    expect(await db.select().from(classGames)).toEqual([]);
    expect(await db.select().from(homework)).toEqual([]);
    expect(await db.select().from(tournaments)).toEqual([]);
  });
});
