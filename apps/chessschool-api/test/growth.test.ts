import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { completeNode, createInitialState, PATH, type AuthResponse, type Progress } from "@chessschool/design";
import { createApp } from "../src/app";
import type { Db } from "../src/db";
import { FEATURES } from "../src/features";
import { CHALLENGES_PER_DAY, INVITE_MONTHLY_CAP, newCode } from "../src/growth";
import { cached, growthStats } from "../src/growth-stats";
import { challenges, events, freezeBank, inviteAccepts, invites, puzzles, shares } from "../src/schema";
import { cardData, cardId, cardSvg, CARD_H, CARD_W, loadCardRenderer, type Card, type CardStore } from "../src/share-card";
import { seededDb } from "./course-fixture";

let NOW = new Date("2026-11-16T10:00:00Z");
let app: ReturnType<typeof createApp>;
let db: Db;
let ip = 0;
let store: Map<string, Uint8Array>;
const cardStore: CardStore = { get: async (k) => store.get(k) ?? null, put: async (k, png) => void store.set(k, png) };

beforeEach(async () => {
  NOW = new Date("2026-11-16T10:00:00Z");
  db = await seededDb();
  store = new Map();
  app = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => NOW, adminEmails: ["admin@b.co"], cardStore, crashFree: async () => 99.7 });
});

async function raw(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": `10.1.0.${++ip}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await raw(method, path, body, token);
  return { status: res.status, json: (await res.json()) as any };
}
const register = async (name: string, email: string) => (await call("POST", "/v1/auth/register", { name, email, password: "pawnpawn" })).json as AuthResponse;
function lessons(n: number): Progress {
  let s = createInitialState("g");
  // The tour ("meet") first, then n lessons: only the lessons count toward the invite.
  for (const node of PATH.slice(0, n + 1)) s = completeNode(s, node.id, NOW);
  return s.progress;
}
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const pngSize = (png: Uint8Array) => [new DataView(png.buffer, png.byteOffset).getUint32(16), new DataView(png.buffer, png.byteOffset).getUint32(20)];

describe("share cards", () => {
  it("keeps only the fields a kind needs and gives the same content the same id", () => {
    expect(cardData("game_won", { fen: START, moves: 31, name: "Riya", note: "<b>" })).toEqual({ fen: START, moves: 31 });
    expect(cardData("game_won", { moves: 31 })).toBeNull();
    expect(cardData("certificate", { unit: "<script>" })).toBeNull();
    expect(cardData("league_promotion", { league: "Knight" })).toEqual({ league: "Knight" });
    const card: Card = { kind: "rating_milestone", lang: "en", data: { rating: 900 }, avatar: "cody", name: null };
    expect(cardId(card)).toBe(cardId({ ...card }));
    expect(cardId(card)).not.toBe(cardId({ ...card, lang: "hi" }));
  });

  it("renders every kind as a 1080x1920 PNG with a QR code, in English and Hindi", async () => {
    await loadCardRenderer();
    const samples: [Card["kind"], Card["data"]][] = [
      ["game_won", { fen: START, moves: 31 }],
      ["puzzle_streak", { streak: 12 }],
      ["rating_milestone", { rating: 900 }],
      ["certificate", { unit: "Unit 1 · First steps".replace("·", "-") }],
      ["league_promotion", { league: "Knight" }],
      ["mate_of_the_day", { fen: START, mate: 2 }],
      ["weekly", { lessons: 4, puzzles: 9, streak: 5 }],
    ];
    for (const [kind, data] of samples) {
      const svg = cardSvg({ kind, lang: "hi", data, avatar: "kira", name: null }, "abc123");
      expect(svg).toContain(`width="${CARD_W}" height="${CARD_H}"`);
      expect(svg).toContain("chess-school.in/s/abc123");
    }
    const { token } = await register("Asha Rao", "asha@b.co");
    const made = await call("POST", "/v1/shares", { kind: "game_won", data: { fen: START, moves: 31 }, lang: "en", showName: true }, token);
    expect(made.status).toBe(201);
    expect(made.json.url).toBe(`https://chess-school.in/s/${made.json.id}`);
    expect((await db.select().from(shares))[0]).toMatchObject({ name: "Asha", kind: "game_won" });
    const res = await raw("GET", made.json.image);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const png = new Uint8Array(await res.arrayBuffer());
    expect([...png.slice(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
    expect(pngSize(png)).toEqual([CARD_W, CARD_H]);
    // The second request is served from the cache.
    expect(store.size).toBe(1);
    const again = new Uint8Array(await (await raw("GET", made.json.image)).arrayBuffer());
    expect(again.length).toBe(png.length);
    expect((await call("GET", `/v1/shares/${made.json.id}`)).json).toMatchObject({ kind: "game_won", lang: "en" });
    expect((await raw("GET", `/v1/share/card/weekly?id=${made.json.id}`)).status).toBe(404);
    expect((await raw("GET", "/v1/share/card/game_won?id=nope-nope-nope")).status).toBe(404);
  }, 60_000);

  it("never puts a name on a child's card or a guest's card, and can be switched off", async () => {
    const { token } = await register("Asha Rao", "asha2@b.co");
    const kid = (await call("POST", "/v1/children", { name: "Riya" }, token)).json.child.id;
    await call("POST", "/v1/shares", { kind: "puzzle_streak", data: { streak: 5 }, showName: true, child: kid }, token);
    await call("POST", "/v1/shares", { kind: "puzzle_streak", data: { streak: 6 }, showName: true });
    await call("POST", "/v1/shares", { kind: "puzzle_streak", data: { streak: 7 } }, token);
    expect((await db.select().from(shares)).map((s) => s.name)).toEqual([null, null, null]);
    expect((await call("POST", "/v1/shares", { kind: "puzzle_streak", data: { streak: 5 }, child: "not-mine" }, token)).status).toBe(400);
    expect((await call("POST", "/v1/shares", { kind: "nope", data: {} }, token)).status).toBe(400);
    FEATURES.shareCards = false;
    try {
      expect((await call("POST", "/v1/shares", { kind: "puzzle_streak", data: { streak: 5 } }, token)).status).toBe(404);
      expect((await call("GET", "/v1/features")).json.features.shareCards).toBe(false);
    } finally {
      FEATURES.shareCards = true;
    }
  });
});

describe("challenge a friend", () => {
  it("routes codes: random, unguessable alphabet, 404 for unknown and malformed ones", async () => {
    const codes = new Set(Array.from({ length: 200 }, () => newCode()));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[2-9a-hj-km-np-z]{8}$/);
    expect((await call("GET", "/v1/challenges/zzzzzzzz")).status).toBe(404);
    expect((await call("GET", "/v1/challenges/..%2F..")).status).toBe(404);
  });

  it("a puzzle challenge works for a guest, keeps the first answer, and expires after 7 days", async () => {
    const { token } = await register("Asha Rao", "c1@b.co");
    await db.insert(puzzles).values({ id: "pz-1", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", moves: JSON.stringify(["a1a8"]), rating: 600, themes: JSON.stringify(["backRankMate"]), packVersion: "test" });
    const pz = (await db.select().from(puzzles).limit(1))[0]!;
    expect((await call("POST", "/v1/challenges", { kind: "puzzle", puzzleId: "nope" }, token)).status).toBe(400);
    expect((await call("POST", "/v1/challenges", { kind: "puzzle", puzzleId: pz.id })).status).toBe(401);
    const made = (await call("POST", "/v1/challenges", { kind: "puzzle", puzzleId: pz.id, solved: true }, token)).json.challenge;
    expect(made).toMatchObject({ kind: "puzzle", creator: { name: "Asha" }, creatorResult: "solved", friendResult: null, url: `https://chess-school.in/c/${made.code}` });
    // The guest sees the puzzle with no account.
    const seen = (await call("GET", `/v1/challenges/${made.code}`)).json.challenge;
    expect(seen.puzzle).toMatchObject({ id: pz.id, fen: pz.fen });
    expect(seen.you).toBeNull();
    expect((await call("POST", `/v1/challenges/${made.code}/result`, { solved: false })).json.challenge.friendResult).toBe("missed");
    expect((await call("POST", `/v1/challenges/${made.code}/result`, { solved: true })).json.challenge.friendResult).toBe("missed");
    NOW = new Date(NOW.getTime() + 7 * 86_400_000 + 1);
    expect((await call("GET", `/v1/challenges/${made.code}`)).json.challenge.expired).toBe(true);
    expect((await call("POST", `/v1/challenges/${made.code}/result`, { solved: true })).status).toBe(410);
  });

  it("an async game: the friend takes a seat with no account, moves alternate, and a third person cannot join", async () => {
    const { token } = await register("Asha Rao", "c2@b.co");
    const made = (await call("POST", "/v1/challenges", { kind: "game" }, token)).json.challenge;
    expect(made).toMatchObject({ kind: "game", status: "waiting", you: "w", yourTurn: false });
    expect((await call("POST", `/v1/challenges/${made.code}/accept`, {}, token)).status).toBe(409); // not your own
    const joined = (await call("POST", `/v1/challenges/${made.code}/accept`)).json;
    expect(joined.challenge).toMatchObject({ status: "active", you: "b", yourTurn: false });
    expect((await call("POST", `/v1/challenges/${made.code}/accept`)).status).toBe(409);
    const move = (from: string, to: string, who: { seat?: string; token?: string }) => call("POST", `/v1/challenges/${made.code}/moves`, { from, to, seat: who.seat }, who.token);
    expect((await move("e7", "e5", { seat: joined.seat })).status).toBe(409); // White moves first
    expect((await move("f2", "f3", {})).status).toBe(403); // an onlooker
    expect((await move("f2", "f5", { token })).status).toBe(400);
    expect((await move("f2", "f3", { token })).json.challenge.moves).toEqual(["f3"]);
    await move("e7", "e5", { seat: joined.seat });
    await move("g2", "g4", { token });
    const mate = (await move("d8", "h4", { seat: joined.seat })).json.challenge;
    expect(mate).toMatchObject({ status: "over", result: "0-1", moves: ["f3", "e5", "g4", "Qh4#"] });
    expect((await call("GET", `/v1/challenges/${made.code}?seat=${joined.seat}`)).json.challenge.you).toBe("b");
    expect((await db.select().from(challenges))[0]!.blackSeat).not.toBe(joined.seat); // stored hashed
  });

  it("caps a creator at 20 a day, and a child's challenge shows the avatar only", async () => {
    const { token, user } = await register("Asha Rao", "c3@b.co");
    const kid = (await call("POST", "/v1/children", { name: "Riya" }, token)).json.child.id;
    const child = (await call("POST", "/v1/challenges", { kind: "game", child: kid }, token)).json.challenge;
    expect(child.creator).toEqual({ name: null, avatar: expect.any(String) });
    for (let i = 1; i < CHALLENGES_PER_DAY; i++) expect((await call("POST", "/v1/challenges", { kind: "game" }, token)).status).toBe(201);
    expect((await call("POST", "/v1/challenges", { kind: "game" }, token)).status).toBe(429);
    NOW = new Date(NOW.getTime() + 86_400_000 + 1);
    expect((await call("POST", "/v1/challenges", { kind: "game" }, token)).status).toBe(201);
    expect((await call("DELETE", "/v1/me", undefined, token)).status).toBe(200);
    expect(await db.select().from(challenges).where(eq(challenges.creatorId, user.id))).toEqual([]);
  });
});

describe("invite rewards", () => {
  it("pays both sides 2 freezes once the friend finishes 3 lessons, exactly once", async () => {
    const inviter = await register("Asha Rao", "i1@b.co");
    const mine = (await call("GET", "/v1/invites/mine", undefined, inviter.token)).json;
    expect(mine).toMatchObject({ url: `https://chess-school.in/i/${mine.code}`, rewards: 0, cap: 10, banked: 0 });
    expect((await call("GET", "/v1/invites/mine", undefined, inviter.token)).json.code).toBe(mine.code);
    expect((await call("GET", `/v1/invites/${mine.code}`)).json).toEqual({ code: mine.code, name: "Asha" });
    expect((await call("GET", "/v1/invites/zzzzzzzz")).status).toBe(404);
    expect((await call("POST", "/v1/invites/accept", { code: mine.code }, inviter.token)).status).toBe(400); // not your own

    const friend = await register("Ravi", "i2@b.co");
    expect((await call("POST", "/v1/invites/accept", { code: mine.code }, friend.token)).json.accepted).toBe(true);
    expect((await call("POST", "/v1/invites/accept", { code: mine.code }, friend.token)).json.accepted).toBe(false);
    await call("PUT", "/v1/progress", { progress: lessons(2) }, friend.token);
    expect(await db.select().from(freezeBank)).toEqual([]);
    await call("PUT", "/v1/progress", { progress: lessons(3) }, friend.token);
    await call("PUT", "/v1/progress", { progress: lessons(4) }, friend.token); // pays once
    const bank = Object.fromEntries((await db.select().from(freezeBank)).map((b) => [b.userId, b.banked]));
    expect(bank).toEqual({ [inviter.user.id]: 2, [friend.user.id]: 2 });
    expect((await call("GET", "/v1/invites/mine", undefined, inviter.token)).json).toMatchObject({ rewards: 1, banked: 2 });

    // Claiming respects FREEZE_MAX (2): a streak that already holds 1 takes 1, the other stays banked.
    expect((await call("POST", "/v1/invites/claim", { have: 1 }, inviter.token)).json).toEqual({ freezes: 1, banked: 1 });
    expect((await call("POST", "/v1/invites/claim", { have: 2 }, inviter.token)).json).toEqual({ freezes: 0, banked: 1 });
    expect((await call("POST", "/v1/invites/claim", { have: 0 }, inviter.token)).json).toEqual({ freezes: 1, banked: 0 });
    expect((await call("POST", "/v1/invites/claim", { have: 9 }, inviter.token)).status).toBe(400);
  });

  it("holds the cap of 10 rewards a month per inviter (the friend is still paid) and cleans up on account deletion", async () => {
    const inviter = await register("Asha Rao", "cap@b.co");
    const { code } = (await call("GET", "/v1/invites/mine", undefined, inviter.token)).json;
    for (let i = 0; i < INVITE_MONTHLY_CAP + 1; i++) {
      const friend = await register(`F${i}`, `f${i}@b.co`);
      await call("POST", "/v1/invites/accept", { code }, friend.token);
      await call("PUT", "/v1/progress", { progress: lessons(3) }, friend.token);
    }
    const rows = await db.select().from(inviteAccepts);
    expect(rows.filter((r) => r.rewardedAt).length).toBe(INVITE_MONTHLY_CAP + 1);
    expect(rows.filter((r) => r.inviterRewarded).length).toBe(INVITE_MONTHLY_CAP);
    expect((await db.select().from(freezeBank).where(eq(freezeBank.userId, inviter.user.id)))[0]!.banked).toBe(INVITE_MONTHLY_CAP * 2);
    expect((await call("GET", "/v1/invites/mine", undefined, inviter.token)).json.rewards).toBe(INVITE_MONTHLY_CAP);
    expect((await call("DELETE", "/v1/me", undefined, inviter.token)).status).toBe(200);
    expect(await db.select().from(invites)).toEqual([]);
    expect(await db.select().from(inviteAccepts)).toEqual([]);
    expect(await db.select().from(freezeBank).where(eq(freezeBank.userId, inviter.user.id))).toEqual([]);
  });
});

describe("class leaderboard by weekly XP", () => {
  it("ranks classmates by the XP of this week's lessons", async () => {
    const a = await register("Asha", "l1@b.co");
    const b = await register("Ravi", "l2@b.co");
    const room = (await call("POST", "/v1/classes", { name: "Club" }, a.token)).json.class;
    await call("POST", "/v1/classes/join", { code: room.code }, b.token);
    await call("PUT", "/v1/progress", { progress: lessons(1) }, a.token);
    await call("PUT", "/v1/progress", { progress: lessons(3) }, b.token);
    const board = (await call("GET", `/v1/classes/${room.id}/leaderboard?day=2026-11-16`, undefined, a.token)).json;
    const xp = (n: number) => PATH.slice(0, n + 1).reduce((sum, p) => sum + p.xp, 0);
    expect(board.entries.map((e: { name: string; xp: number; lessons: number }) => [e.name, e.xp, e.lessons])).toEqual([
      ["Ravi", xp(3), 4],
      ["Asha", xp(1), 2],
    ]);
  });
});

describe("growth dashboard", () => {
  const at = (day: string) => Date.parse(`${day}T09:00:00Z`);
  const ev = (install: string, day: string, name = "app_open") => ({ at: at(day), install, name, platform: "web", appVersion: "1.0.0" });

  it("matches a hand count on a seeded month", async () => {
    // Today is 2026-11-16. a: first 10-10, back on day 1, 7 and 30 (11-09). b: first 10-10, back on day 1 only.
    // c: first 11-14, back on day 1 (11-15), shares twice. d: first today (too new for any cohort).
    await db.insert(events).values([
      ev("a", "2026-10-10"), ev("a", "2026-10-11"), ev("a", "2026-10-17"), ev("a", "2026-11-09"),
      ev("b", "2026-10-10"), ev("b", "2026-10-11"),
      ev("c", "2026-11-14"), ev("c", "2026-11-15"), ev("c", "2026-11-15", "share"), ev("c", "2026-11-15", "share"),
      ev("d", "2026-11-16"),
    ]);
    await db.insert(inviteAccepts).values([
      { invitedId: "u1", inviterId: "u0", createdAt: 1, rewardedAt: 2, inviterRewarded: true },
      { invitedId: "u2", inviterId: "u0", createdAt: 1 },
      { invitedId: "u3", inviterId: "u0", createdAt: 1 },
      { invitedId: "u4", inviterId: "u0", createdAt: 1, rewardedAt: 2, inviterRewarded: true },
    ]);
    const s = await growthStats(db, NOW.getTime(), 99.7);
    // D1: cohort a, b, c (d's day 1 is not over) and all three came back. D7: a, b, c? c's day 7 is in the future: cohort a, b; only a.
    expect(s.retention).toEqual({ d1: 100, d7: 50, d30: 50, cohort: { d1: 3, d7: 2, d30: 2 } });
    // Last 30 days are 10-18..11-16: a (11-09), c (11-14, 11-15), d (11-16) are active: MAU 3, 4 active install-days.
    expect(s.mau).toBe(3);
    expect(s.daily).toHaveLength(30);
    expect(s.daily.reduce((n, d) => n + d.installs, 0)).toBe(4);
    expect(s.stickiness).toBe(Math.round((4 / 30 / 3) * 1000) / 10);
    expect(s.shares).toBe(2);
    expect(s.sharesPerActive).toBe(0.67);
    expect(s.invites).toEqual({ accepted: 4, rewarded: 2, conversion: 50 });
    expect(s.crashFree).toBe(99.7);
  });

  it("is for admins only, accepts the share event, and caches the crash reporter lookup", async () => {
    const admin = await register("Admin", "admin@b.co");
    const other = await register("Other", "o@b.co");
    expect((await call("GET", "/v1/admin/growth")).status).toBe(401);
    expect((await call("GET", "/v1/admin/growth", undefined, other.token)).status).toBe(403);
    const sent = await call("POST", "/v1/events", { install: "inst-1", platform: "web", appVersion: "1.0.0", events: [{ name: "share", at: NOW.getTime() }] });
    expect(sent.json.stored).toBe(1);
    const s = (await call("GET", "/v1/admin/growth", undefined, admin.token)).json;
    expect(s).toMatchObject({ shares: 1, mau: 1, crashFree: 99.7, retention: { d1: null } });

    let calls = 0;
    let t = 0;
    const get = cached(async () => (++calls === 2 ? Promise.reject(new Error("down")) : calls), 1000, () => t);
    expect([await get(), await get()]).toEqual([1, 1]);
    t = 2000;
    expect(await get()).toBeNull(); // a failed lookup reads as "not available"
    expect(calls).toBe(2);
  });
});
