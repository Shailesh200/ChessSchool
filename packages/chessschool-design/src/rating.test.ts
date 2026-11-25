import { describe, expect, it } from "vitest";
import { ADAPT_RANGE, ADAPT_TARGET, adoptRatings, applyResult, botRatingOf, emptyRatings, glicko2, nudgeBot, queueRating, ratingSent, sanitizeRatings } from "./rating";

describe("Glicko-2", () => {
  it("matches Glickman's worked example", () => {
    const next = glicko2({ rating: 1500, rd: 200, vol: 0.06 }, [
      { rating: 1400, rd: 30, score: 1 },
      { rating: 1550, rd: 100, score: 0 },
      { rating: 1700, rd: 300, score: 0 },
    ]);
    expect(next.rating).toBeCloseTo(1464.06, 1);
    expect(next.rd).toBeCloseTo(151.52, 1);
    expect(next.vol).toBeCloseTo(0.05999, 4);
  });

  it("a bot win raises the learner and the bot; puzzles never move the playing rating (as on chess.com)", () => {
    expect(emptyRatings().player.rating).toBe(400);
    const won = applyResult(emptyRatings(), { kind: "bot", bot: "cody", target: 700, score: 1 });
    expect(won.player.rating).toBeGreaterThan(400);
    expect(won.player.games).toBe(1);
    expect(won.bots.cody).toBeGreaterThan(700);
    expect(applyResult(won, { kind: "puzzle", puzzleRating: 600, solved: false })).toBe(won);
    expect(applyResult(won, { kind: "puzzle", puzzleRating: 2000, solved: true })).toBe(won);
  });
});

describe("adaptive bots", () => {
  it("an adapted strength saved before the bots got stronger is pulled into range", () => {
    expect(botRatingOf({ ...emptyRatings(), bots: { pip: 400 } }, "pip", 1000)).toBe(1000 - ADAPT_RANGE);
    expect(botRatingOf(emptyRatings(), "pip", 1000)).toBe(1000);
  });

  it("nudges up after a win, down after a loss, within range", () => {
    expect(nudgeBot(700, 700, 1)).toBeGreaterThan(700);
    expect(nudgeBot(700, 700, 0)).toBeLessThan(700);
    expect(nudgeBot(700, 700, 0.5)).toBeLessThan(700);
    expect(nudgeBot(700 + ADAPT_RANGE, 700, 1)).toBe(700 + ADAPT_RANGE);
    expect(nudgeBot(400 - ADAPT_RANGE, 400, 0)).toBe(400 - ADAPT_RANGE);
  });

  it("settles where the learner wins about 55-60%", () => {
    // A learner of strength 800 (within reach of the bot's range) playing a bot whose expected score follows the Elo curve.
    let bot = 700;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const scores: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const p = 1 / (1 + 10 ** ((bot - 800) / 400));
      const s = rand() < p ? 1 : 0;
      scores.push(s);
      bot = nudgeBot(bot, 700, s);
    }
    const recent = scores.slice(-1000).reduce((a, b) => a + b, 0) / 1000;
    expect(recent).toBeGreaterThan(0.55);
    expect(recent).toBeLessThan(0.6);
    expect(ADAPT_TARGET).toBeCloseTo(0.575);
  });

  it("sanitizes stored ratings", () => {
    expect(sanitizeRatings(null)).toEqual(emptyRatings());
    expect(sanitizeRatings({ player: { rating: 99999, rd: -1 }, bots: { cody: 750, "x y": 1 } })).toEqual({ player: { rating: 3000, rd: 30, vol: 0.06, games: 0 }, bots: { cody: 750 } });
  });
});

describe("offline rated results", () => {
  const rated = (event: string) => ({ input: { kind: "bot" as const, event, bot: "cody", result: "win" as const, moves: 30 }, result: { kind: "bot" as const, bot: "cody", target: 700, score: 1 as const } });

  it("an offline event survives a sync and is only replaced once the server has it", async () => {
    const { createInitialState } = await import("./progress");
    let s = queueRating(createInitialState("g"), rated("g-1"));
    const local = s.ratings;
    expect(local.player.games).toBe(1);
    // The server, not yet told about g-1, answers a sync with its older ratings: keep ours.
    s = adoptRatings(s, null, emptyRatings());
    expect(s.ratings).toEqual(local);
    expect(s.ratingQueue.map((q) => q.event)).toEqual(["g-1"]);
    // g-1 reaches the server; its answer now includes it and replaces the device copy.
    const server = applyResult(emptyRatings(), rated("g-1").result);
    s = ratingSent(s, s.ratingQueue[0], server);
    expect(s.ratingQueue).toEqual([]);
    expect(s.ratings).toEqual(server);
  });
});

describe("bot order", () => {
  it("adapted strengths can't swap neighbouring bots (the roster is 300 apart)", () => {
    expect(ADAPT_RANGE * 2).toBeLessThan(300);
    const r = { ...emptyRatings(), bots: { bishop: 5000, atlas: 0 } };
    expect(botRatingOf(r, "bishop", 900)).toBeLessThan(botRatingOf(r, "atlas", 1200));
  });
});
