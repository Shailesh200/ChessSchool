import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { completeNode, createInitialState, PATH, type AuthResponse, type Progress } from "@chessschool/design";
import { createApp } from "../src/app";
import { openDb, type Db } from "../src/db";
import { googleVerifierFromEnv, type GoogleVerifier } from "../src/google";
import { classMembers, classes, feedback, profiles, progress, sessions, users } from "../src/schema";

const NOW = new Date("2026-11-03T10:00:00Z");
let app: ReturnType<typeof createApp>;
let db: Db;
let ip = 0;

const fakeGoogle: GoogleVerifier = async (token) => {
  if (token === "good") return { sub: "g-1", email: "asha@example.com", emailVerified: true, name: "Asha G" };
  if (token === "new") return { sub: "g-2", email: "new@example.com", emailVerified: true, name: "Newbie" };
  return null;
};

beforeEach(async () => {
  db = await openDb(":memory:");
  app = createApp({ db, google: fakeGoogle, secureCookies: false, corsOrigins: [], now: () => NOW });
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
  it("serves the outline without steps, and one open lesson with its steps", async () => {
    const outline = await call("GET", "/v1/course?outline=1");
    expect(outline.status).toBe(200);
    const centre = outline.json.lessons.find((l: { id: string }) => l.id === "centre");
    expect(centre.title).toBe("The centre");
    expect(centre.steps).toBeUndefined();
    expect(centre.state).toBe("locked");
    expect(centre.lockedReason).toBe("guest");
    expect(outline.json.guestLimitReached).toBe(false);
    expect(outline.json.path[0]).toMatchObject({ id: "meet", state: "current", playable: true });
    expect(outline.json.units.length).toBeGreaterThan(3);

    const full = await call("GET", "/v1/course");
    expect(full.json.lessons.find((l: { id: string; steps: unknown[] }) => l.id === "board").steps.length).toBeGreaterThan(0);
    expect(full.json.lessons.find((l: { id: string; steps?: unknown }) => l.id === "centre").steps).toBeUndefined();

    const one = await call("GET", "/v1/lessons/board");
    expect(one.status).toBe(200);
    expect(one.json.steps.length).toBeGreaterThan(0);
    const capped = await call("GET", "/v1/lessons/centre");
    expect(capped.status).toBe(403);
    expect(capped.json).toMatchObject({ error: "GUEST_CLASS_LIMIT", guestLimitReached: true, lockedReason: "guest" });
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

  it("links to an existing email account and blocks password login only for Google-only users", async () => {
    await call("POST", "/v1/auth/register", { name: "Asha", email: "asha@example.com", password: "pawnpawn" });
    const linked = await call("POST", "/v1/auth/google", { idToken: "good" });
    expect(linked.json.user.provider).toBe("password");
    await call("POST", "/v1/auth/google", { idToken: "new" });
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
    expect(home.json.path).toHaveLength(PATH.length);
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
    expect(home.json.guestLimitReached).toBe(false);
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
    expect(fourth.json).toMatchObject({ error: "GUEST_CLASS_LIMIT", guestLimitReached: true, lockedReason: "guest" });

    const { token } = await guestAccount();
    const three = progressThrough("moves");
    const saved = await call("PUT", "/v1/progress", { progress: three }, token);
    expect(saved.status).toBe(200);
    expect(saved.json.guestLimitReached).toBe(true);
    expect(saved.json.path.find((n: { id: string }) => n.id === "pawns")).toMatchObject({ state: "locked", lockedReason: "guest", playable: false });
    expect((await call("GET", "/v1/lessons/pawns", undefined, token)).json.error).toBe("GUEST_CLASS_LIMIT");

    const four = progressThrough("pawns");
    const blocked = await call("PUT", "/v1/progress", { progress: four }, token);
    expect(blocked.status).toBe(403);
    expect(blocked.json).toMatchObject({ error: "GUEST_CLASS_LIMIT", guestLimitReached: true, lockedReason: "guest" });
    const home = await call("GET", "/v1/home", undefined, token);
    expect(home.json.guestLimitReached).toBe(true);
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
    expect(saved.json.guestLimitReached).toBe(false);
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
