import { START_FEN, type AdminMetrics, type AuthResponse } from "@chessschool/design";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Db } from "../src/db";
import { seededDb } from "./course-fixture";

const NOW = new Date("2026-11-20T10:00:00Z");
let app: ReturnType<typeof createApp>;
let db: Db;
let ip = 0;

beforeEach(async () => {
  db = await seededDb();
  app = createApp({
    db,
    google: null,
    secureCookies: false,
    corsOrigins: [],
    now: () => NOW,
    adminEmails: ["admin@b.co"],
  });
});

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-forwarded-for": `10.2.0.${++ip}`,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await app.request(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}
const register = async (name: string, email: string) =>
  (
    (await call("POST", "/v1/auth/register", { name, email, password: "pawnpawn" }))
      .json as AuthResponse
  ).token;

describe("admin metrics", () => {
  it("counts accounts, games and challenges, leaves out QA accounts, and is admin-only", async () => {
    const admin = await register("Admin", "admin@b.co");
    const asha = await register("Asha", "a@b.co");
    await register("Tester", "qa+run-abcdef1-1@b.co");
    const game = (id: string, winner: "w" | "b" | null) => ({
      id,
      endedAt: NOW.getTime() - 1000,
      setup: {
        opponent: { kind: "bot", bot: "pip" },
        you: "w",
        time: "none",
        startFen: START_FEN,
        takebacks: true,
        askPromotion: true,
      },
      history: ["e4"],
      winner,
      reason: "resigned",
    });
    await call("PUT", "/v1/games/g1", { game: game("g1", "w") }, asha);
    await call("PUT", "/v1/games/g2", { game: game("g2", "b") }, asha);
    await call("POST", "/v1/challenges", { kind: "game", tc: "10m" }, asha);

    expect((await call("GET", "/v1/admin/metrics", undefined, asha)).status).toBe(403);
    const out = await call("GET", "/v1/admin/metrics?days=7", undefined, admin);
    expect(out.status).toBe(200);
    const m = out.json as AdminMetrics;
    expect(m.accounts).toMatchObject({
      total: 2,
      new: 2,
      methods: { password: 2, google: 0, apple: 0 },
    });
    expect(m.games).toMatchObject({
      total: 2,
      bot: 2,
      won: 1,
      lost: 1,
      drawn: 0,
      bots: [{ bot: "pip", played: 2, won: 1 }],
    });
    expect(m.challenges).toMatchObject({
      created: 1,
      joined: 0,
      byClock: { "10m": 1 },
    });
  });
});
