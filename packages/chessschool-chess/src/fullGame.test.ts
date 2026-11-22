import { describe, expect, it } from "vitest";
import { START_FEN, type Color } from "./board";
import { chooseMove } from "./bot";
import { coachMoments, keyMomentCard, moveFacts } from "./coach";
import { load } from "./game";
import { playReduce, startGame, defaultSetup, winnerOf, type PlayState } from "./play";
import { assessMove, EVAL_CAP, formatEval, moveNoAt, plyName, reviewPlies, summarise, type MoveNote, type ReviewPly } from "./review";

const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** The whole post-game pipeline the review screen runs, with the checks every screen relies on. */
function analyse(startFen: string, history: string[], side: Color | null) {
  const plies = reviewPlies(startFen, history);
  expect(plies.length).toBe(history.length);
  const notes: Record<number, MoveNote> = {};
  for (const p of plies) notes[p.ply] = assessMove(p);
  plies.forEach((p, i) => {
    // Sides alternate, numbering follows the position's own move count.
    if (i) expect(p.by).not.toBe(plies[i - 1].by);
    if (i) expect(p.moveNo).toBe(plies[i - 1].moveNo + (p.by === "w" ? 1 : 0));
    const n = notes[p.ply];
    expect(n.loss).toBeGreaterThanOrEqual(0);
    expect(Math.abs(n.evalAfter)).toBeLessThanOrEqual(EVAL_CAP);
    expect(formatEval(n.evalAfter)).toMatch(/^([+−]?\d+\.\d|[+−]M)$/);
    if (n.verdict === "good") expect(n.better).toBeNull();
    else {
      // A mistake always comes with a different, legal better move whose arrow matches it.
      expect(n.better).not.toBeNull();
      expect(n.better).not.toBe(p.san);
      const m = load(p.fenBefore).move(n.better!);
      expect(n.betterMove).toEqual({ from: m.from, to: m.to });
    }
    const f = moveFacts(p, n);
    expect(f.by).toBe(p.by);
    if (f.hanging) expect(load(p.fen).get(f.hanging.square)?.color).toBe(p.by);
    if (f.freeCapture) expect(load(p.fenBefore).get(f.freeCapture.square)?.color).not.toBe(p.by);
    if (f.better) {
      const m = load(p.fenBefore).move(f.better);
      expect(f.betterMove).toEqual({ from: m.from, to: m.to });
    }
    if (f.allowedMate) expect(load(p.fen).move(f.allowedMate).san).toMatch(/#$/);
  });
  const sum = summarise(plies, notes, side);
  const mine = plies.filter((p) => !side || p.by === side);
  expect(Object.values(sum.counts).reduce((a, b) => a + b, 0)).toBe(mine.length);
  expect(sum.accuracy).toBeGreaterThanOrEqual(0);
  expect(sum.accuracy).toBeLessThanOrEqual(100);
  for (const m of sum.moments) {
    expect(mine.some((p) => p.ply === m.ply)).toBe(true);
  }
  expect([...sum.moments].sort((a, b) => a.ply - b.ply)).toEqual(sum.moments);
  const key = keyMomentCard(plies, notes, side);
  if (key) {
    const p = plies[key.ply - 1];
    expect(key.by).toBe(p.by);
    if (side) expect(key.by).toBe(side);
    expect(key.move).toBe(plyName(p));
    if (key.better) {
      const m = load(p.fenBefore).move(key.better);
      expect(key.betterMove).toEqual({ from: m.from, to: m.to });
    }
  }
  const coach = coachMoments(startFen, history, side);
  for (const m of coach) {
    const p = plies[m.ply - 1];
    expect(m.by).toBe(p.by);
    expect(m.moveNo).toBe(p.moveNo);
    if (side) expect(m.by).toBe(side);
    if (m.better) expect(m.better).not.toBe(m.san);
  }
  return { plies, notes, sum, key, coach };
}

const facts = (plies: ReviewPly[], notes: Record<number, MoveNote>, ply: number) => moveFacts(plies[ply - 1], notes[ply]);

describe("a full game through the analysis", () => {
  it("scholar's mate: the losing move is the key moment and it allowed the mate", () => {
    const history = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];
    const { plies, notes, sum, key, coach } = analyse(START_FEN, history, "b");
    expect(notes[6].verdict).toBe("blunder");
    expect(key?.ply).toBe(6);
    expect(key?.move).toBe("3… Nf6");
    expect(facts(plies, notes, 6).allowedMate).toBe("Qxf7#");
    expect(sum.moments.map((m) => m.ply)).toContain(6);
    expect(coach.map((m) => m.ply)).toContain(6);
    // The winner's view: the mate is a moment, no mistake from White.
    const white = analyse(START_FEN, history, "w");
    expect(white.sum.moments.at(-1)).toEqual({ ply: 7, kind: "mate" });
    expect(white.sum.counts.blunder).toBe(0);
  });

  it("a hung queen, then resign: the facts name the loose queen and what it cost", () => {
    const history = ["e4", "e5", "Qh5", "Nc6", "Qxe5+", "Nxe5"];
    let s: PlayState = startGame({ ...defaultSetup("pip"), you: "w" }, 0);
    for (const san of history) {
      const m = load(s.fen).move(san);
      s = playReduce(s, { type: s.setup.you === m.color ? "move" : "bot", move: { from: m.from, to: m.to }, now: 0 } as never);
    }
    expect(s.history).toEqual(history);
    s = playReduce(s, { type: "resign", now: 0 });
    expect(winnerOf(s)).toBe("b");
    const { plies, notes, key } = analyse(START_FEN, s.history, "w");
    expect(notes[5].verdict).toBe("blunder");
    const f = facts(plies, notes, 5);
    expect(f.hanging).toEqual({ square: "e5", piece: "q" });
    expect(f.lossPiece).toBe("q");
    expect(key?.ply).toBe(5);
  });

  it("a missed back-rank mate is called a missed mate, with the mating move as the better one", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
    const { plies, notes, key } = analyse(fen, ["h3"], "w");
    expect(notes[1].verdict).not.toBe("good");
    const f = facts(plies, notes, 1);
    expect(f.better).toBe("Ra8#");
    expect(f.missedMate).toBe(true);
    expect(key?.better).toBe("Ra8#");
    expect(key?.betterMove).toEqual({ from: "a1", to: "a8" });
  });

  it("numbers moves from the position, not from 1 (set positions, Black to move)", () => {
    const italian = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const a = analyse(italian, ["O-O", "Nf6", "d3"], "w");
    expect(a.plies.map(plyName)).toEqual(["4. O-O", "4… Nf6", "5. d3"]);
    expect(moveNoAt(a.plies, 3)).toBe(5);
    const black = analyse("4k3/8/8/8/8/8/4P3/4K3 b - - 0 1", ["Kd7", "e4", "Ke6"], "b");
    expect(black.plies.map(plyName)).toEqual(["1… Kd7", "2. e4", "2… Ke6"]);
  });

  it("a short bot-vs-bot game, ended by resignation, runs the whole pipeline both ways", () => {
    const rand = rng(11);
    const chess = load(START_FEN);
    const history: string[] = [];
    while (!chess.isGameOver() && history.length < 24) {
      const m = chooseMove(chess.fen(), "pip", rand)!;
      history.push(chess.move(m.san).san);
    }
    analyse(START_FEN, history, "w");
    analyse(START_FEN, history, "b");
    analyse(START_FEN, history, null);
  }, 60_000);
});

describe("bot names", () => {
  it("follow the pieces by strength, with ids and ratings unchanged, and take the app language's words", async () => {
    const { BOTS, setBotText } = await import("./bot");
    expect(BOTS.map((b) => [b.id, b.name, b.rating])).toEqual([
      ["pip", "Pip", 300],
      ["rooky", "Sir Gallop", 600],
      ["bishop", "Professor Bishop", 900],
      ["ivy", "Rooky", 1200],
      ["atlas", "King Ivy", 1500],
      ["raja", "King Atlas", 1800],
      ["cody", "Chaukor", 2100],
    ]);
    setBotText({ pip: { name: "पिप" } });
    expect(BOTS[0].name).toBe("पिप");
    expect(BOTS[0].blurb).toMatch(/captures/);
    setBotText({});
    expect(BOTS[0].name).toBe("Pip");
  });
});

describe("stored setups", () => {
  it("keep the start position id and the players' colours through a save and reload", async () => {
    const { parseSetup, playerHues } = await import("./play");
    const s = parseSetup({ ...defaultSetup("pip"), startId: "kq-k", whiteHue: "orange" })!;
    expect(s.startId).toBe("kq-k");
    expect(playerHues(s.whiteHue)).toEqual({ w: "orange", b: "blue" });
    // Older games get a stable colour from their id.
    expect(playerHues(undefined, "g1")).toEqual(playerHues(undefined, "g1"));
    expect(parseSetup({ ...defaultSetup("pip"), whiteHue: "red" })!.whiteHue).toBeUndefined();
  });
});
