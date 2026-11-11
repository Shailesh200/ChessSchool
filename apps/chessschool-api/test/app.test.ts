import { beforeEach, describe, expect, it } from "vitest";
import { completeNode, createInitialState, PATH, type AuthResponse } from "@chessschool/design";
import { createApp } from "../src/app";
import { openDb } from "../src/db";
import type { GoogleVerifier } from "../src/google";

const NOW = new Date("2026-11-03T10:00:00Z");
let app: ReturnType<typeof createApp>;
let ip = 0;

const fakeGoogle: GoogleVerifier = async (token) => {
  if (token === "good") return { sub: "g-1", email: "asha@example.com", emailVerified: true, name: "Asha G" };
  if (token === "new") return { sub: "g-2", email: "new@example.com", emailVerified: true, name: "Newbie" };
  return null;
};

beforeEach(async () => {
  const db = await openDb(":memory:");
  app = createApp({ db, google: fakeGoogle, secureCookies: false, corsOrigins: [], now: () => NOW });
});

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
  it("serves the outline without steps, and one lesson with its steps", async () => {
    const outline = await call("GET", "/v1/course?outline=1");
    expect(outline.status).toBe(200);
    const centre = outline.json.lessons.find((l: { id: string }) => l.id === "centre");
    expect(centre.title).toBe("The centre");
    expect(centre.steps).toBeUndefined();
    expect(outline.json.units.length).toBeGreaterThan(3);

    const full = await call("GET", "/v1/course");
    expect(full.json.lessons.find((l: { id: string; steps: unknown[] }) => l.id === "centre").steps.length).toBeGreaterThan(0);

    const one = await call("GET", "/v1/lessons/centre");
    expect(one.status).toBe(200);
    expect(one.json.steps.length).toBeGreaterThan(0);
    expect((await call("GET", "/v1/lessons/missing")).status).toBe(404);
  });
});

describe("health", () => {
  it("responds", async () => {
    const r = await call("GET", "/v1/health");
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    expect(r.json.app).toBe("0.4.0");
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

describe("account deletion and feedback", () => {
  it("deletes the account, its sessions and progress", async () => {
    const { token } = (await call("POST", "/v1/auth/register", { name: "D", email: "d@b.co", password: "pawnpawn" })).json as AuthResponse;
    await call("PUT", "/v1/progress", { progress: guestDone().progress }, token);
    expect((await call("DELETE", "/v1/me", undefined, token)).status).toBe(200);
    expect((await call("GET", "/v1/me", undefined, token)).status).toBe(401);
    expect((await call("DELETE", "/v1/me")).status).toBe(401);
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
