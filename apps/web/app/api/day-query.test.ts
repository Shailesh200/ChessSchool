import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { practiceRow } = vi.hoisted(() => ({
  practiceRow: {
    id: "hw-fork",
    title: "Fork",
    tag: "fork",
    emoji: "🍴",
    steps: JSON.stringify([
      {
        kind: "move",
        fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
        solution: ["e1:e2"],
        coach: "Step in.",
      },
    ]),
  },
}));

vi.mock("@/db", () => {
  const query = {
    from() {
      return query;
    },
    where() {
      return query;
    },
    orderBy() {
      return Promise.resolve([practiceRow]);
    },
  };
  return { db: { select: () => query } };
});

import { GET as dailyPuzzle } from "./daily-puzzle/route";
import { GET as think } from "./think/route";

const SERVER_NOON = new Date("2026-07-15T12:00:00.000Z");
const IST_0355 = new Date("2026-07-14T22:25:00.000Z"); // 03:55 IST on 2026-07-15

const routes = [
  { name: "daily-puzzle", path: "/api/daily-puzzle", get: dailyPuzzle },
  { name: "think", path: "/api/think", get: think },
] as const;

describe("?day= on daily-puzzle and think", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SERVER_NOON);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(routes)("$name returns 400 for a bad format", async ({ path, get }) => {
    const res = await get(new Request(`http://localhost${path}?day=07-15-2026`));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_day" });
  });

  it.each(routes)(
    "$name returns 400 for server UTC day +2 and -2",
    async ({ path, get }) => {
      const plus = await get(new Request(`http://localhost${path}?day=2026-07-17`));
      const minus = await get(new Request(`http://localhost${path}?day=2026-07-13`));
      expect(plus.status).toBe(400);
      expect(minus.status).toBe(400);
    },
  );

  it.each(routes)("$name returns 400 for an impossible date", async ({ path, get }) => {
    const res = await get(new Request(`http://localhost${path}?day=2026-02-30`));
    expect(res.status).toBe(400);
  });

  it.each(routes)(
    "$name uses the server day when ?day= is missing",
    async ({ path, get }) => {
      const res = await get(new Request(`http://localhost${path}`));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ day: "2026-07-15" });
    },
  );

  it.each(routes)("$name accepts the local day at 03:55 IST", async ({ path, get }) => {
    vi.setSystemTime(IST_0355);
    const res = await get(new Request(`http://localhost${path}?day=2026-07-15`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ day: "2026-07-15" });
  });
});
