import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthResponse, BoardResponse, MyDetails, PlayerProfile, SafetyReport } from "@chessschool/design";
import { createApp } from "../src/app";
import { deleteUserData } from "../src/account-delete";
import type { Db } from "../src/db";
import { blocks, follows, invites, profileDetails, reports, supportMessages, suspensions, users } from "../src/schema";
import { PHOTO_HIDE_REPORTS, type PhotoStore } from "../src/social";
import { backfillUsernames, ensureUsername } from "../src/usernames";
import type { Sender } from "../src/weekly";
import { seededDb } from "./course-fixture";

let app: ReturnType<typeof createApp>;
let db: Db;
let ip = 0;
let stored: Map<string, Uint8Array>;
let mails: { to: string; subject: string; text: string }[];
const NOW = new Date("2026-11-20T10:00:00Z");
const photoStore: PhotoStore = {
  put: async (key, bytes) => (stored.set(key, bytes), `https://cdn.test/${key}`),
  remove: async (url) => void stored.delete(url.replace("https://cdn.test/", "")),
};
const sender: Sender = { email: async (to, subject, _html, text) => (mails.push({ to, subject, text }), true), push: async () => true };

beforeEach(async () => {
  db = await seededDb();
  stored = new Map();
  mails = [];
  app = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => NOW, adminEmails: ["admin@b.co"], photoStore, weekly: sender });
});

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": `10.4.0.${++ip}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as any, headers: res.headers };
}
const register = async (name: string, email: string) => (await call("POST", "/v1/auth/register", { name, email, password: "pawnpawn" })).json as AuthResponse;
const win = (event: string) => ({ kind: "bot", event, bot: "pip", result: "win", moves: 40 });
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString("base64");
const boardIds = async (token: string) => ((await call("GET", "/v1/leaderboard?scope=global&metric=rating", undefined, token)).json as BoardResponse).rows.map((r) => r.id);

describe("name checks", () => {
  it("refuses bad names wherever a name is set, and lets the admin account keep a team name", async () => {
    const bad = await call("POST", "/v1/auth/register", { name: "ChessSchool Official", email: "x@b.co", password: "pawnpawn" });
    expect(bad.status).toBe(400);
    expect(bad.json).toMatchObject({ error: "name_not_allowed", message: "reserved" });
    expect((await call("POST", "/v1/auth/register", { name: "Admin", email: "admin@b.co", password: "pawnpawn" })).status).toBe(201);
    const a = await register("Asha", "asha@b.co");
    expect((await call("PATCH", "/v1/me", { name: "chutiya" }, a.token)).json).toMatchObject({ error: "name_not_allowed", message: "rude" });
    expect((await call("PATCH", "/v1/me", { name: "visit riya.com" }, a.token)).json.message).toBe("link");
    expect((await call("PATCH", "/v1/me", { name: "Asha Rao" }, a.token)).json.user.name).toBe("Asha Rao");
    expect((await call("POST", "/v1/children", { name: "Admin" }, a.token)).json.error).toBe("name_not_allowed");
    expect((await call("POST", "/v1/classes", { name: "fuck class" }, a.token)).json.error).toBe("name_not_allowed");
    expect((await call("POST", "/v1/classes", { name: "ChessSchool Pune 7B" }, a.token)).status).toBe(201);
  });
});

describe("report and block", () => {
  it("hides blocked players from each other's boards and stops friends, codes and challenges", async () => {
    const a = await register("Asha", "a@b.co");
    const b = await register("Bilal", "b@b.co");
    await call("POST", "/v1/me/rating", win("a1"), a.token);
    await call("POST", "/v1/me/rating", win("b1"), b.token);
    await call("POST", `/v1/friends/${b.user.id}`, {}, a.token);
    expect(await boardIds(a.token)).toContain(b.user.id);

    const rep = await call("POST", `/v1/players/${b.user.id}/report`, { reason: "behaviour", note: "rude in a game" }, a.token);
    expect(rep.status).toBe(200);
    expect(await db.select().from(reports)).toHaveLength(1);
    expect((await db.select().from(reports))[0]).toMatchObject({ classId: "", reason: "behaviour", status: "open" });
    // Reporting blocks by default and ends the friendship.
    expect(await db.select().from(follows)).toEqual([]);
    expect(await boardIds(a.token)).not.toContain(b.user.id);
    expect(await boardIds(b.token)).not.toContain(a.user.id);
    expect((await call("POST", `/v1/friends/${a.user.id}`, {}, b.token)).status).toBe(404);
    expect((await call("GET", `/v1/players/${a.user.id}`, undefined, b.token)).status).toBe(404);

    await db.insert(invites).values({ code: "abcdefgh", userId: a.user.id, createdAt: 1 });
    expect((await call("POST", "/v1/friends/code", { code: "abcdefgh" }, b.token)).status).toBe(404);

    const game = (await call("POST", "/v1/challenges", { kind: "game", tc: "1d" }, a.token)).json.challenge;
    expect((await call("POST", `/v1/challenges/${game.code}/accept`, {}, b.token)).status).toBe(404);

    expect((await call("GET", "/v1/me/blocks", undefined, a.token)).json.blocked).toMatchObject([{ id: b.user.id, name: "Bilal" }]);
    await call("DELETE", `/v1/players/${b.user.id}/block`, undefined, a.token);
    expect(await boardIds(a.token)).toContain(b.user.id);
    expect((await call("POST", `/v1/challenges/${game.code}/accept`, {}, b.token)).status).toBe(200);

    expect((await call("POST", `/v1/challenges/${game.code}/report`, { reason: "behaviour", block: false }, b.token)).status).toBe(200);
    expect((await db.select().from(reports)).filter((r) => r.reportedId === a.user.id)).toHaveLength(1);
    expect((await call("POST", `/v1/challenges/${game.code}/report`, { reason: "behaviour" }, a.token)).status).toBe(400);
    expect((await call("POST", `/v1/players/${b.user.id}/report`, { reason: "spam" }, a.token)).status).toBe(400);
    expect((await call("POST", `/v1/players/${a.user.id}/block`, {}, a.token)).status).toBe(400);
  });

  it("hides a photo once enough people report it, until an admin decides", async () => {
    const owner = await register("Riya", "r@b.co");
    expect((await call("POST", "/v1/me/photo", { image: JPEG, mediaType: "image/jpeg" }, owner.token)).status).toBe(200);
    const reporters = await Promise.all(Array.from({ length: PHOTO_HIDE_REPORTS }, (_, i) => register(`Fan ${"abc"[i]}`, `f${i}@b.co`)));
    const viewer = await register("Kabir", "k@b.co");
    const photoOf = async () => ((await call("GET", `/v1/players/${owner.user.id}`, undefined, viewer.token)).json.player as PlayerProfile).photo;
    expect(await photoOf()).toMatch(/^https:\/\/cdn\.test\/avatars\//);
    for (const r of reporters) await call("POST", `/v1/players/${owner.user.id}/report`, { reason: "photo", block: false }, r.token);
    expect(await photoOf()).toBeNull();
    expect(((await call("GET", "/v1/me/details", undefined, owner.token)).json as MyDetails).photoHidden).toBe(true);

    const admin = (await register("Admin", "admin@b.co")).token;
    const queue = (await call("GET", "/v1/admin/safety", undefined, admin)).json.reports as SafetyReport[];
    expect(queue).toHaveLength(PHOTO_HIDE_REPORTS);
    expect(queue[0]).toMatchObject({ reportedId: owner.user.id, reason: "photo", openAboutThem: PHOTO_HIDE_REPORTS });
    // Dismissing one leaves too few open reports, so the photo shows again.
    await call("POST", `/v1/admin/safety/reports/${queue[0]!.id}`, { action: "dismiss" }, admin);
    expect(await photoOf()).not.toBeNull();
    await call("POST", `/v1/admin/safety/reports/${queue[1]!.id}`, { action: "hide_photo" }, admin);
    expect(await photoOf()).toBeNull();
    expect(stored.size).toBe(0);
    expect((await call("GET", "/v1/admin/safety", undefined, reporters[0]!.token)).status).toBe(403);
  });

  it("lets an admin clear a name and suspend an account", async () => {
    const bad = await register("Kabir", "bad@b.co");
    const a = await register("Asha", "a2@b.co");
    await call("POST", "/v1/me/rating", win("x1"), bad.token);
    await call("POST", `/v1/players/${bad.user.id}/report`, { reason: "name", block: false }, a.token);
    await call("POST", `/v1/players/${bad.user.id}/report`, { reason: "cheating", block: false }, a.token);
    const admin = (await register("Admin", "admin@b.co")).token;
    const queue = (await call("GET", "/v1/admin/safety", undefined, admin)).json.reports as SafetyReport[];
    const name = queue.find((r) => r.reason === "name");
    const cheat = queue.find((r) => r.reason === "cheating");
    await call("POST", `/v1/admin/safety/reports/${name!.id}`, { action: "hide_name" }, admin);
    expect((await db.query.users.findFirst({ where: eq(users.id, bad.user.id) }))!.name).toBe("");
    expect((await call("POST", `/v1/admin/safety/reports/${cheat!.id}`, { action: "ban" }, admin)).status).toBe(400);
    await call("POST", `/v1/admin/safety/reports/${cheat!.id}`, { action: "suspend" }, admin);
    expect((await call("GET", "/v1/me", undefined, bad.token)).status).toBe(401);
    const login = await call("POST", "/v1/auth/login", { email: "bad@b.co", password: "pawnpawn" });
    expect(login.json.error).toBe("suspended");
    expect(await boardIds(a.token)).not.toContain(bad.user.id);
    await call("POST", `/v1/admin/safety/reports/${cheat!.id}`, { action: "unsuspend" }, admin);
    expect((await call("POST", "/v1/auth/login", { email: "bad@b.co", password: "pawnpawn" })).status).toBe(200);
  });
});

describe("profile details, photo and friends", () => {
  it("saves details, shows them publicly, and keeps a child's city and links private", async () => {
    const a = await register("Asha", "a@b.co");
    const v = await register("Kabir", "v@b.co");
    const saved = await call("PUT", "/v1/me/details", { bio: "Endgames!", favPiece: "knight", city: "Pune", playingSince: 2021, banner: "gold", socials: { lichess: "lichess.org/@/asha", instagram: "@asha.plays" } }, a.token);
    expect(saved.status).toBe(200);
    expect((saved.json as MyDetails).details.socials).toEqual({ lichess: "asha", instagram: "asha.plays" });
    expect((await call("PUT", "/v1/me/details", { bio: "whatsapp 9876543210" }, a.token)).json).toMatchObject({ error: "invalid_input", message: "bio:link" });
    expect((await call("PUT", "/v1/me/details", { socials: { x: "not a handle" } }, a.token)).json.message).toBe("socials.x:invalid");

    const seen = (await call("GET", `/v1/players/${a.user.id}`, undefined, v.token)).json.player as PlayerProfile;
    expect(seen).toMatchObject({ name: "Asha", me: false, friend: false, details: { city: "Pune", favPiece: "knight", banner: "gold" } });
    await call("PATCH", "/v1/me", { who: "child" }, a.token);
    const child = (await call("GET", `/v1/players/${a.user.id}`, undefined, v.token)).json.player as PlayerProfile;
    expect(child.details).toMatchObject({ city: "", socials: {}, bio: "Endgames!" });
    expect((await call("GET", `/v1/players/${a.user.id}`, undefined, a.token)).json.player.details.city).toBe("Pune");
    expect((await call("GET", "/v1/players/nobody", undefined, v.token)).status).toBe(404);
  });

  it("uploads, replaces and removes a photo, refusing anything that isn't an image", async () => {
    const a = await register("Asha", "a@b.co");
    expect((await call("POST", "/v1/me/photo", { image: Buffer.from("<svg>".repeat(40)).toString("base64"), mediaType: "image/jpeg" }, a.token)).status).toBe(400);
    expect((await call("POST", "/v1/me/photo", { image: JPEG, mediaType: "image/gif" }, a.token)).status).toBe(400);
    const first = (await call("POST", "/v1/me/photo", { image: JPEG, mediaType: "image/jpeg" }, a.token)).json as MyDetails;
    const second = (await call("POST", "/v1/me/photo", { image: JPEG, mediaType: "image/jpeg" }, a.token)).json as MyDetails;
    expect(second.photo).not.toBe(first.photo);
    expect(stored.size).toBe(1);
    const b = await register("Bilal", "b@b.co");
    await call("POST", "/v1/me/rating", win("a1"), a.token);
    const row = ((await call("GET", "/v1/leaderboard?scope=global&metric=rating", undefined, b.token)).json as BoardResponse).rows.find((r) => r.id === a.user.id);
    expect(row!.photo).toBe(second.photo);
    expect(((await call("DELETE", "/v1/me/photo", undefined, a.token)).json as MyDetails).photo).toBeNull();
    expect(stored.size).toBe(0);

    const off = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => NOW });
    const res = await off.request("/v1/me/photo", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` }, body: JSON.stringify({ image: JPEG, mediaType: "image/jpeg" }) });
    expect(res.status).toBe(503);
  });

  it("makes friends both ways by code and by accepting an invite", async () => {
    const a = await register("Asha", "a@b.co");
    const b = await register("Bilal", "b@b.co");
    const c = await register("Chen", "c@b.co");
    const code = (await call("GET", "/v1/invites/mine", undefined, a.token)).json.code as string;
    expect((await call("POST", "/v1/friends/code", { code }, a.token)).status).toBe(409);
    expect((await call("POST", "/v1/friends/code", { code: "zzzzzzzz" }, b.token)).status).toBe(404);
    expect((await call("POST", "/v1/friends/code", { code: code.toUpperCase() }, b.token)).json).toMatchObject({ ok: true, friend: { id: a.user.id, name: "Asha" } });
    await call("POST", "/v1/invites/accept", { code }, c.token);
    const pairs = (await db.select().from(follows)).map((f) => `${f.userId}>${f.friendId}`).sort();
    expect(pairs).toEqual([`${a.user.id}>${b.user.id}`, `${a.user.id}>${c.user.id}`, `${b.user.id}>${a.user.id}`, `${c.user.id}>${a.user.id}`].sort());
    expect((await call("GET", `/v1/players/${a.user.id}`, undefined, b.token)).json.player.friend).toBe(true);
  });
});

describe("usernames", () => {
  it("gives every new account a unique username from the first name and finds friends by it", async () => {
    const a = await register("Asha Rao", "a@b.co");
    const b = await register("Asha Iyer", "b@b.co");
    const hindi = await register("आशा", "h@b.co");
    expect(a.user.username).toMatch(/^asha\d{4}$/);
    expect(b.user.username).toMatch(/^asha\d{4}$/);
    expect(b.user.username).not.toBe(a.user.username);
    expect(hindi.user.username).toMatch(/^chess\d{4}$/);
    expect((await call("GET", "/v1/me", undefined, a.token)).json.user.username).toBe(a.user.username);

    expect((await call("POST", "/v1/friends/username", { username: a.user.username }, a.token)).status).toBe(409);
    expect((await call("POST", "/v1/friends/username", { username: "nobody_here" }, b.token)).status).toBe(404);
    const added = await call("POST", "/v1/friends/username", { username: `@${a.user.username!.toUpperCase()}` }, b.token);
    expect(added.json).toMatchObject({ ok: true, friend: { id: a.user.id, name: "Asha", username: a.user.username } });
    // Older apps type it into the friend-code box.
    const c = await register("Chen", "c@b.co");
    expect((await call("POST", "/v1/friends/code", { code: a.user.username }, c.token)).json).toMatchObject({ ok: true, friend: { id: a.user.id } });
    expect((await call("GET", `/v1/players/${a.user.id}`, undefined, b.token)).json.player.username).toBe(a.user.username);
  });

  it("changes a username: checked live, unique ignoring case, never reserved", async () => {
    const a = await register("Asha", "a@b.co");
    const b = await register("Bilal", "b@b.co");
    expect((await call("GET", "/v1/usernames/check?u=Asha_R", undefined, a.token)).json).toMatchObject({ username: "asha_r", available: true, problem: null });
    expect((await call("GET", "/v1/usernames/check?u=admin", undefined, a.token)).json).toMatchObject({ available: false, problem: "reserved" });
    expect((await call("GET", `/v1/usernames/check?u=${a.user.username}`, undefined, a.token)).json.available).toBe(true);
    expect((await call("GET", `/v1/usernames/check?u=${a.user.username}`, undefined, b.token)).json).toMatchObject({ available: false, problem: "taken" });
    expect((await call("PUT", "/v1/me/username", { username: "Asha_R" }, a.token)).json).toEqual({ username: "asha_r" });
    expect((await call("PUT", "/v1/me/username", { username: "ASHA_R" }, b.token))).toMatchObject({ status: 409, json: { message: "taken" } });
    expect((await call("PUT", "/v1/me/username", { username: "no spaces" }, b.token))).toMatchObject({ status: 400, json: { message: "chars" } });
    expect((await call("GET", "/v1/me", undefined, a.token)).json.user.username).toBe("asha_r");
    // The database refuses a clash even past the route's check.
    await expect(db.update(users).set({ username: "ASHA_R" }).where(eq(users.id, b.user.id))).rejects.toThrow();
  });

  it("fills in accounts from before usernames, lazily and in the backfill", async () => {
    const a = await register("Asha", "a@b.co");
    const b = await register("Bilal", "b@b.co");
    await db.update(users).set({ username: null });
    expect(await backfillUsernames(db)).toBe(2);
    expect((await db.select().from(users)).every((u) => u.username)).toBe(true);
    expect(await backfillUsernames(db)).toBe(0);
    await db.update(users).set({ username: null }).where(eq(users.id, a.user.id));
    expect((await call("GET", "/v1/me", undefined, a.token)).json.user.username).toMatch(/^asha\d{4}$/);
    expect(b.user.username).toBeTruthy();
  });

  it("retries a clash with another account's username", async () => {
    const a = await register("Asha", "a@b.co");
    const fresh = { id: "u-new", name: "Asha", username: null as string | null };
    await db.insert(users).values({ id: fresh.id, email: "new@b.co", name: "Asha", createdAt: 1 });
    const digits = (Number(a.user.username!.slice(4)) + 0.5) / 10_000;
    const other = (digits + 0.5) % 1;
    const rolls = [digits, digits, other];
    expect(await ensureUsername(db, fresh, () => rolls.shift() ?? 0)).toBe(`asha${String(Math.floor(other * 10_000)).padStart(4, "0")}`);
  });
});

describe("public profile", () => {
  it("shows stats, trophies and recent games, without naming friend opponents", async () => {
    const a = await register("Asha", "a@b.co");
    const b = await register("Bilal", "b@b.co");
    const game = (id: string, opponent: unknown, winner: "w" | "b" | null, endedAt: number) => ({ id, endedAt, setup: { opponent, you: "w", time: "none", startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", takebacks: false, askPromotion: false }, history: ["e4", "e5"], winner, reason: "checkmate" });
    await call("PUT", "/v1/games/g1", { game: game("g1", { kind: "bot", bot: "pip" }, "w", 1) }, a.token);
    await call("PUT", "/v1/games/g2", { game: game("g2", { kind: "friend" }, "b", 2) }, a.token);
    const p = (await call("GET", `/v1/players/${a.user.id}`, undefined, b.token)).json.player as PlayerProfile;
    expect(p).toMatchObject({ username: a.user.username, streak: 0, lessons: 0, puzzleRating: null, games: { played: 0, won: 0 } });
    expect(p.recent).toEqual([
      { id: "g2", endedAt: 2, result: "loss", opponent: { kind: "friend" }, moves: 2 },
      { id: "g1", endedAt: 1, result: "win", opponent: { kind: "bot", bot: "pip" }, moves: 2 },
    ]);
    expect(Array.isArray(p.badges)).toBe(true);
  });
});

describe("support and data export", () => {
  it("stores a message and emails the admins; guests must leave an email", async () => {
    const a = await register("Asha", "a@b.co");
    const ok = await call("POST", "/v1/support", { topic: "problem", message: "The board froze after castling.", platform: "ios", version: "0.7.0" }, a.token);
    expect(ok.status).toBe(200);
    expect((await db.select().from(supportMessages))[0]).toMatchObject({ email: "a@b.co", platform: "ios", emailed: true });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: "admin@b.co" });
    expect(mails[0]!.text).toContain("The board froze");
    expect((await call("POST", "/v1/support", { topic: "problem", message: "Guest without an email here" })).status).toBe(400);
    expect((await call("POST", "/v1/support", { topic: "idea", message: "Add more puzzles please", email: "g@b.co", platform: "web" })).status).toBe(200);
    expect((await call("POST", "/v1/support", { topic: "idea", message: "short" }, a.token)).status).toBe(400);
  });

  it("exports the account's data and deletes the new rows with the account", async () => {
    const a = await register("Asha", "a@b.co");
    const b = await register("Bilal", "b@b.co");
    await call("PUT", "/v1/me/details", { bio: "Hi" }, a.token);
    await call("POST", "/v1/me/photo", { image: JPEG, mediaType: "image/jpeg" }, a.token);
    await call("POST", `/v1/friends/${b.user.id}`, {}, a.token);
    await call("POST", `/v1/players/${b.user.id}/report`, { reason: "other", note: "test" }, a.token);
    await call("POST", "/v1/support", { topic: "account", message: "Please check my account." }, a.token);
    const saved = { id: "g1", endedAt: 1000, setup: { opponent: { kind: "bot", bot: "pip" }, you: "w", time: "none", startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", takebacks: true, askPromotion: true }, history: ["e4", "e5"], winner: "w", reason: "resigned" };
    expect((await call("PUT", "/v1/games/g1", { game: saved }, a.token)).status).toBe(200);
    const out = await call("GET", "/v1/me/export", undefined, a.token);
    expect(out.status).toBe(200);
    expect(out.headers.get("content-disposition")).toContain("chessschool-data-2026-11-20.json");
    expect(out.json).toMatchObject({ account: { email: "a@b.co", name: "Asha" }, details: { details: { bio: "Hi" } }, reportsMade: [{ reportedId: b.user.id, reason: "other" }], support: [{ topic: "account" }], savedGames: [{ game: { id: "g1", history: ["e4", "e5"] } }] });
    expect(JSON.stringify(out.json)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect((await call("GET", "/v1/me/export")).status).toBe(401);

    await db.insert(suspensions).values({ userId: a.user.id, createdAt: 1 });
    await deleteUserData(db, a.user.id);
    expect(await db.select().from(profileDetails)).toEqual([]);
    expect(await db.select().from(supportMessages)).toEqual([]);
    expect(await db.select().from(suspensions)).toEqual([]);
    expect(await db.select().from(reports)).toEqual([]);
    expect(await db.select().from(blocks)).toEqual([]);
  });
});
