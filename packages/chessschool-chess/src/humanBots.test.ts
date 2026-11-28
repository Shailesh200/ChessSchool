import { describe, expect, it } from "vitest";
import { BOTS, botOptions, chooseMove, pickByLoss } from "./bot";
import { rankMoves, type RankedMove } from "./engine";
import { load } from "./game";
import { MISTAKES, sampleLoss } from "./mistakes";
import { BANDS, bandOf, CP_BUCKETS, phaseOf } from "./phase";

const seq = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe("mistake model", () => {
  it("loads the Lichess aggregate with every band, phase and kind of position", () => {
    expect(MISTAKES.month).toMatch(/^\d{4}-\d{2}$/);
    expect(MISTAKES.gamesKept).toBeGreaterThan(0);
    for (const b of BANDS) {
      const band = MISTAKES.bands[b];
      expect(band.moves, String(b)).toBeGreaterThan(0);
      for (const phase of ["opening", "middlegame", "endgame"] as const) for (const cell of band.counts[phase]) expect(cell).toHaveLength(CP_BUCKETS.length);
    }
    // Stronger players blunder less.
    expect(MISTAKES.bands[2000].rates.blunder).toBeLessThan(MISTAKES.bands[800].rates.blunder);
  });

  it("bands and phases", () => {
    expect([bandOf(100), bandOf(799), bandOf(1250), bandOf(3000)]).toEqual([400, 600, 1200, 2400]);
    expect(phaseOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", 0)).toBe("opening");
    expect(phaseOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", 30)).toBe("middlegame");
    expect(phaseOf("8/5pk1/6p1/3R4/8/6P1/5PK1/3r4", 2)).toBe("endgame");
  });

  it("samples bigger losses for lower ratings", () => {
    const mean = (rating: number) => {
      const rand = seq(5);
      let sum = 0;
      for (let i = 0; i < 4000; i++) sum += sampleLoss(rating, "middlegame", true, rand);
      return sum / 4000;
    };
    expect(mean(400)).toBeGreaterThan(mean(1200));
    expect(mean(1200)).toBeGreaterThan(mean(2000));
  });
});

describe("bots that err like people", () => {
  const ranked = (scores: [string, number][]): RankedMove[] => scores.map(([san, score]) => ({ move: { san, captured: undefined, piece: "p", to: "e4" } as never, score }));

  it("plays the move nearest the sampled loss", () => {
    const r = ranked([["best", 50], ["ok", 20], ["blunder", -900]]);
    const none = () => 0;
    expect(pickByLoss(r, 0, none, () => 0).san).toBe("best");
    expect(pickByLoss(r, 40, none, () => 0).san).toBe("ok");
    expect(pickByLoss(r, 900, none, () => 0).san).toBe("blunder");
    // A move the bot likes wins a near tie.
    expect(pickByLoss(r, 15, (m) => (m.san === "best" ? 20 : 0), () => 0).san).toBe("best");
  });

  it("loses more centipawns as the rating falls (seeded simulation)", () => {
    const fens = [
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
      "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7",
      "r2q1rk1/pp2bppp/2n1bn2/3p4/3P4/2NBBN2/PP3PPP/R2Q1RK1 w - - 4 11",
      "2r2rk1/pp3ppp/2n1b3/3p4/3P4/2N1B3/PP3PPP/2R2RK1 b - - 0 18",
      "8/5pk1/6p1/3R4/8/6P1/5PK1/3r4 w - - 0 40",
      "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 30",
    ];
    // Scored once at a fixed depth so the simulation does not depend on machine speed.
    const lists = fens.map((fen) => ({ fen, ranked: rankMoves(fen, { depth: 2, quiescence: 3, timeMs: 60_000 }) }));
    const acpl = (rating: number) => {
      const rand = seq(42);
      let loss = 0;
      let n = 0;
      for (let i = 0; i < 150; i++) {
        for (const { fen, ranked } of lists) {
          const ply = 2 * Number(fen.split(" ")[5]);
          const tactical = load(fen).moves({ verbose: true }).some((m) => m.captured || /[+#]$/.test(m.san));
          const m = pickByLoss(ranked, sampleLoss(rating, phaseOf(fen.split(" ")[0], ply), tactical, rand), () => 0, rand);
          const cap = (x: number) => Math.max(-1000, Math.min(1000, x));
          loss += cap(ranked[0].score) - cap(ranked.find((r) => r.move.san === m.san)!.score);
          n++;
        }
      }
      return loss / n;
    };
    const [low, mid, high] = [acpl(400), acpl(1000), acpl(1800)];
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  }, 30_000);

  it("seven bots rated 300 to 2100 on the chess.com scale, each playing harder than the last", () => {
    expect(BOTS.map((b) => b.rating)).toEqual([300, 600, 900, 1200, 1500, 1800, 2100]);
    expect(BOTS.map((b) => b.level)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const strengths = BOTS.map((b) => b.strength);
    expect([...strengths].sort((a, b) => a - b)).toEqual(strengths);
    // The 2-star bot plays like Professor Bishop did in 0.6 (strength 1250).
    expect(BOTS[1].strength).toBe(1250);
  });

  it("is deterministic under a seeded rand and accepts an adapted rating", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    expect(chooseMove(fen, "pip", seq(3), 150)?.san).toBe(chooseMove(fen, "pip", seq(3), 150)?.san);
    expect(load(fen).moves().includes(chooseMove(fen, "atlas", seq(3), 2100)!.san)).toBe(true);
  });
});

describe("botOptions (the AI bot's choices)", () => {
  it("offers up to n legal moves that fit as well as chooseMove's pick, which comes first", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const opts = botOptions(fen, "rooky", seq(7), undefined, 4);
    // Only near-equal alternatives are offered, so the AI's style never costs the bot strength.
    expect(opts.length).toBeGreaterThanOrEqual(1);
    expect(opts.length).toBeLessThanOrEqual(4);
    const legal = load(fen).moves();
    expect(opts.every((m) => legal.includes(m.san))).toBe(true);
    expect(opts[0]!.san).toBe(chooseMove(fen, "rooky", seq(7))!.san);
  });
});
