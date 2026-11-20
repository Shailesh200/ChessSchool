import { sharedDailyPuzzle } from "@chessschool/chess";
import { START_FEN, type AuthResponse, type GameRecord } from "@chessschool/design";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Db } from "../src/db";
import { dailyDayOk, GAMES_KEPT } from "../src/play";
import { puzzles, savedGames } from "../src/schema";
import { seededDb } from "./course-fixture";

const NOW = new Date("2026-11-20T10:00:00Z");
let app: ReturnType<typeof createApp>;
let db: Db;
let ip = 0;

beforeEach(async () => {
  db = await seededDb();
  app = createApp({ db, google: null, secureCookies: false, corsOrigins: [], now: () => NOW });
});

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": `10.1.0.${++ip}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as any };
}
const register = async (email: string) => ((await call("POST", "/v1/auth/register", { name: "Asha", email, password: "pawnpawn" })).json as AuthResponse).token;

const game = (id: string, endedAt: number, over: Partial<GameRecord> = {}): GameRecord => ({
  id,
  endedAt,
  setup: { opponent: { kind: "bot", bot: "pip" }, you: "w", time: "none", startFen: START_FEN, takebacks: true, askPromotion: true },
  history: ["e4", "e5", "Nf3"],
  winner: "w",
  reason: "resigned",
  ...over,
});

describe("my games", () => {
  it("saves, lists newest first, replaces on a retry and deletes; each account sees only its own", async () => {
    const token = await register("games@b.co");
    const other = await register("other@b.co");
    expect((await call("PUT", "/v1/games/a", { game: game("a", 1000) }, token)).status).toBe(200);
    expect((await call("PUT", "/v1/games/b", { game: game("b", 2000) }, token)).status).toBe(200);
    expect((await call("PUT", "/v1/games/a", { game: game("a", 1000, { winner: "b" }) }, token)).status).toBe(200);
    const list = await call("GET", "/v1/games", undefined, token);
    expect(list.json.games.map((g: GameRecord) => [g.id, g.winner])).toEqual([["b", "w"], ["a", "b"]]);
    expect((await call("GET", "/v1/games", undefined, other)).json.games).toEqual([]);
    await call("DELETE", "/v1/games/a", undefined, token);
    expect((await call("GET", "/v1/games", undefined, token)).json.games).toHaveLength(1);
  });

  it("refuses a bad game, a mismatched id, a stranger's child and no sign-in", async () => {
    const token = await register("bad@b.co");
    expect((await call("PUT", "/v1/games/a", { game: game("b", 1) }, token)).status).toBe(400);
    expect((await call("PUT", "/v1/games/a", { game: { ...game("a", 1), history: ["<b>"] } }, token)).status).toBe(400);
    expect((await call("PUT", "/v1/games/a", { game: game("a", 1), child: "not-mine" }, token)).status).toBe(404);
    expect((await call("GET", "/v1/games")).status).toBe(401);
  });

  it("keeps a child's games apart and removes them with the child", async () => {
    const token = await register("parent@b.co");
    const child = (await call("POST", "/v1/children", { name: "Mini", avatar: "otto" }, token)).json.child.id as string;
    await call("PUT", "/v1/games/k", { game: game("k", 5), child }, token);
    expect((await call("GET", `/v1/games?child=${child}`, undefined, token)).json.games.map((g: GameRecord) => g.id)).toEqual(["k"]);
    expect((await call("GET", "/v1/games", undefined, token)).json.games).toEqual([]);
    await call("DELETE", `/v1/children/${child}`, undefined, token);
    expect(await db.select().from(savedGames).where(eq(savedGames.learnerId, child))).toEqual([]);
  });

  it("keeps the newest games when a learner passes the limit, and deletes them with the account", async () => {
    const token = await register("many@b.co");
    const me = ((await call("GET", "/v1/me", undefined, token)).json as { user: { id: string } }).user.id;
    await db.insert(savedGames).values(Array.from({ length: GAMES_KEPT }, (_, i) => ({ learnerId: me, id: `old${i}`, userId: me, endedAt: i, data: JSON.stringify(game(`old${i}`, i)), updatedAt: 0 })));
    await call("PUT", "/v1/games/new", { game: game("new", 10_000) }, token);
    const rows = await db.select().from(savedGames).where(eq(savedGames.learnerId, me));
    expect(rows).toHaveLength(GAMES_KEPT);
    expect(rows.some((r) => r.id === "old0")).toBe(false);
    expect((await call("DELETE", "/v1/me", undefined, token)).status).toBe(200);
    expect(await db.select().from(savedGames).where(eq(savedGames.userId, me))).toEqual([]);
  });
});

describe("daily puzzle", () => {
  const seed = async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: `d${String(i).padStart(3, "0")}`, fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", moves: JSON.stringify(["e1e8"]), rating: 900 + i * 10, themes: JSON.stringify(["backRankMate"]), packVersion: "t1" }));
    await db.insert(puzzles).values(rows);
    return rows.map((r) => ({ ...r, moves: ["e1e8"], themes: ["backRankMate"] }));
  };

  it("accepts today in every time zone but not further", () => {
    const t = NOW.getTime();
    expect(dailyDayOk("2026-11-20", t)).toBe(true);
    expect(dailyDayOk("2026-11-21", t)).toBe(true);
    expect(dailyDayOk("2026-11-19", t)).toBe(true);
    expect(dailyDayOk("2026-11-22", t)).toBe(false);
    expect(dailyDayOk("2026-13-01", t)).toBe(false);
  });

  it("serves the same puzzle the apps pick from the same pack, and counts each solver once", async () => {
    expect((await call("GET", "/v1/daily/2026-11-20")).status).toBe(404);
    const pack = await seed();
    const got = await call("GET", "/v1/daily/2026-11-20");
    expect(got.json.puzzle.id).toBe(sharedDailyPuzzle("2026-11-20", pack)!.id);
    expect(got.json.solved).toBe(0);

    const token = await register("daily@b.co");
    const id = got.json.puzzle.id as string;
    expect((await call("POST", "/v1/daily/2026-11-20", { puzzle: id }, token)).json.solved).toBe(1);
    expect((await call("POST", "/v1/daily/2026-11-20", { puzzle: id }, token)).json.solved).toBe(1);
    expect((await call("POST", "/v1/daily/2026-11-20", { puzzle: id, solver: "guest-device-1" })).json.solved).toBe(2);
    expect((await call("POST", "/v1/daily/2026-11-20", { puzzle: id, solver: "guest-device-1" })).json.solved).toBe(2);
    expect((await call("POST", "/v1/daily/2026-11-20", { puzzle: id })).status).toBe(400);
    expect((await call("POST", "/v1/daily/2026-11-25", { puzzle: id }, token)).status).toBe(404);
    expect((await call("GET", "/v1/daily/2026-11-20")).json.solved).toBe(2);
  });
});
