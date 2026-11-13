import { describe, expect, it } from "vitest";
import { boardSquares, isLightSquare, moveEffects, promotionColumn, readFen, squareLabel, START_FEN, type PromotionPiece, type Square } from "./board";
import { chooseMove } from "./bot";
import { legalTargets, load, withTurn } from "./game";
import { buildDrills, LESSONS, MATE_DRILLS, type Step } from "./lessons";
import { currentStep, runnerReduce, startRunner, type RunnerState } from "./runner";
import { defaultSetup, playReduce, playResult, shuffleFen, startGame, timeLeft, START_POSITIONS, type PlaySetup } from "./play";
import { allPuzzles, dailyPuzzle, nextPuzzle, puzzleReduce, startPuzzle, themesForCompletedLessons, updateRating, type PuzzleState } from "./puzzles";
import { assessMove, formatEval, materialEdge, moveCue, positionCue, reviewPlies, startTry, summarise, tryReduce } from "./review";
import { BOTS } from "./bot";
import { PIECE_SETS, isRemovedPieceSet, migratePieceSet, pieceArtwork } from "./pieceSets";

/** Two taps, answering the promotion question (queen unless `promo` says otherwise). */
function rMove(s: RunnerState, from: Square, to: Square, promo: PromotionPiece = "q"): RunnerState {
  const after = runnerReduce(runnerReduce(s, { type: "tap", square: from }), { type: "tap", square: to });
  return after.promotion ? runnerReduce(after, { type: "promote", piece: promo }) : after;
}
function pMove(s: PuzzleState, from: Square, to: Square, promo: PromotionPiece = "q"): PuzzleState {
  const after = puzzleReduce(puzzleReduce(s, { type: "tap", square: from }), { type: "tap", square: to });
  return after.promotion ? puzzleReduce(after, { type: "promote", piece: promo }) : after;
}

const seq = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function solveStars(s: RunnerState): RunnerState | null {
  const queue: RunnerState[] = [s];
  const seen = new Set<string>([`${s.fen}|${s.stars.join()}`]);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur.status === "ready") return cur;
    const [from] = [...readFen(cur.fen).entries()].find(([, p]) => p.color === "w")!;
    for (const to of legalTargets(load(cur.fen), from)) {
      const left = cur.stars.filter((sq) => sq !== to).join();
      const key = `${to}|${left}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(rMove(cur, from, to));
    }
  }
  return null;
}

function solvingMoves(s: RunnerState): number {
  let solved = 0;
  const chess = load(s.fen);
  for (const m of chess.moves({ verbose: true })) {
    const after = rMove(s, m.from as Square, m.to as Square);
    if (after.status === "ready") solved++;
  }
  return solved;
}

function solveStep(s: RunnerState, step: Step): RunnerState {
  switch (step.kind) {
    case "say":
      return s;
    case "tap":
      return runnerReduce(s, { type: "tap", square: step.targets[0] });
    case "choice":
      return runnerReduce(s, { type: "choose", index: step.options.findIndex((o) => o.correct) });
    case "stars":
      return solveStars(s)!;
    case "move": {
      const chess = load(s.fen);
      for (const m of chess.moves({ verbose: true })) {
        const after = rMove(s, m.from as Square, m.to as Square);
        if (after.status === "ready") return after;
      }
      return s;
    }
    case "line": {
      let cur = s;
      while (cur.status !== "ready") {
        if (cur.botThinking) {
          const m = step.moves[cur.lineStep];
          cur = runnerReduce(cur, { type: "bot", move: { from: m.slice(0, 2) as Square, to: m.slice(2, 4) as Square } });
          continue;
        }
        const m = step.moves[cur.lineStep];
        const next = rMove(cur, m.slice(0, 2) as Square, m.slice(2, 4) as Square, (m[4] as PromotionPiece) || "q");
        if (next.misses > cur.misses || next === cur) return cur;
        cur = next;
      }
      return cur;
    }
    case "game": {
      let cur = s;
      const rand = seq(7);
      for (let i = 0; i < 200 && cur.status !== "ready"; i++) {
        if (cur.botThinking) {
          const m = chooseMove(cur.fen, "gentle", rand)!;
          cur = runnerReduce(cur, { type: "bot", move: { from: m.from as Square, to: m.to as Square } });
        } else if (cur.gameMoves >= step.minMoves) {
          cur = runnerReduce(cur, { type: "endGame" });
        } else {
          const m = chooseMove(cur.fen, "gentle", rand)!;
          cur = rMove(cur, m.from as Square, m.to as Square);
        }
      }
      return cur;
    }
  }
}

describe("board model", () => {
  it("reads captures, en passant and promotions from two positions", () => {
    const cap = moveEffects("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "4k3/8/8/3P4/8/8/8/4K3 b - - 0 1", { from: "e4", to: "d5" });
    expect(cap.captured).toEqual({ square: "d5", piece: { type: "p", color: "b" } });
    expect(cap.promoted).toBeNull();
    const ep = moveEffects("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "4k3/8/3P4/8/8/8/8/4K3 b - - 0 1", { from: "e5", to: "d6" });
    expect(ep.captured?.square).toBe("d5");
    const promo = moveEffects("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "N3k3/8/8/8/8/8/8/4K3 b - - 0 1", { from: "a7", to: "a8" });
    expect(promo.promoted).toEqual({ type: "n", color: "w" });
    expect(moveEffects(START_FEN, START_FEN, { from: "e2", to: "e4" })).toEqual({ captured: null, promoted: null });
  });

  it("picks a move sound from two positions", () => {
    expect(positionCue(START_FEN, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", { from: "e2", to: "e4" })).toBe("move");
    expect(positionCue("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "4k3/8/8/3P4/8/8/8/4K3 b - - 0 1", { from: "e4", to: "d5" })).toBe("capture");
    expect(positionCue("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1", { from: "a1", to: "a8" })).toBe("mate");
    expect(positionCue("4k3/8/8/8/8/8/8/R3K3 w Q - 0 1", "4k3/8/8/8/8/8/8/2KR4 b - - 1 1", { from: "e1", to: "c1" })).toBe("castle");
  });

  it("lays the promotion picker from the last rank toward the middle", () => {
    expect(promotionColumn("a8").map((c) => c.square)).toEqual(["a8", "a7", "a6", "a5"]);
    expect(promotionColumn("h1").map((c) => `${c.square}${c.piece}`)).toEqual(["h1q", "h2n", "h3r", "h4b"]);
  });

  it("orients the board and names squares", () => {
    expect(boardSquares("w")[0]).toBe("a8");
    expect(boardSquares("w")[63]).toBe("h1");
    expect(boardSquares("b")[0]).toBe("h1");
    expect(isLightSquare("h1")).toBe(true);
    expect(isLightSquare("a1")).toBe(false);
    expect(readFen(START_FEN).get("e1")).toEqual({ type: "k", color: "w" });
    expect(squareLabel("e4", undefined)).toBe("e4, empty");
    expect(squareLabel("g8", { type: "n", color: "b" })).toBe("g8, black knight");
  });
});

describe("handmade lessons", () => {
  for (const [id, lesson] of Object.entries(LESSONS)) {
    it(`${id} can be finished step by step`, () => {
      let s = startRunner(lesson.steps);
      for (const step of lesson.steps) {
        s = solveStep(s, step);
        expect(s.status, `${id}: ${step.title}`).toBe("ready");
        s = runnerReduce(s, { type: "next" });
      }
      expect(s.status).toBe("finished");
    });
  }

  it("every move puzzle has a solution and rejects at least one legal move", () => {
    for (const step of [...Object.values(LESSONS).flatMap((l) => l.steps), ...MATE_DRILLS]) {
      if (step.kind !== "move") continue;
      const s = startRunner([step]);
      const total = load(step.fen).moves().length;
      const ok = solvingMoves(s);
      expect(ok, step.title).toBeGreaterThan(0);
      expect(ok, step.title).toBeLessThan(total);
    }
  });

  it("every choice has exactly one right answer", () => {
    for (const step of Object.values(LESSONS).flatMap((l) => l.steps)) {
      if (step.kind === "choice") expect(step.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it("a wrong tap counts a miss and shows the hint, then the right tap continues", () => {
    let s = startRunner(LESSONS.board.steps);
    s = runnerReduce(s, { type: "next" });
    s = runnerReduce(s, { type: "next" });
    expect(currentStep(s)?.kind).toBe("tap");
    s = runnerReduce(s, { type: "tap", square: "a1" });
    expect(s.misses).toBe(1);
    expect(s.feedback?.tone).toBe("hint");
    expect(runnerReduce(s, { type: "next" }).index).toBe(s.index);
    s = runnerReduce(s, { type: "tap", square: "e4" });
    expect(s.status).toBe("ready");
  });

  it("a legal but wrong move does not advance", () => {
    const step = LESSONS.check.steps.find((st) => st.kind === "move" && st.goal.type === "mate")!;
    let s = startRunner([step]);
    s = rMove(s, "a1", "a2");
    expect(s.status).toBe("working");
    expect(s.fen).toBe(step.fen);
  });
});

describe("drills", () => {
  it("only uses finished lessons and adds mates after the check lesson", () => {
    expect(buildDrills([], seq())).toHaveLength(0);
    const early = buildDrills(["board"], seq(), 50);
    expect(early.every((d) => LESSONS.board.steps.includes(d))).toBe(true);
    const late = buildDrills(["board", "moves", "pawns", "check"], seq(), 99);
    expect(late.some((d) => MATE_DRILLS.includes(d as never))).toBe(true);
    expect(buildDrills(["board", "moves"], seq())).toHaveLength(5);
  });
});

describe("Cody the bot", () => {
  it("always plays a legal move", () => {
    let fen = START_FEN;
    const rand = seq(3);
    for (let i = 0; i < 30; i++) {
      for (const level of ["gentle", "steady"] as const) {
        const chess = load(fen);
        if (chess.isGameOver()) return;
        const m = chooseMove(fen, level, rand)!;
        expect(chess.moves().includes(m.san)).toBe(true);
        chess.move(m.san);
        fen = chess.fen();
      }
    }
  });

  it("steady takes a free queen and finds mate in one", () => {
    expect(chooseMove("4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1", "steady", seq())?.san).toBe("Qxd5");
    expect(chooseMove("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "steady", seq())?.san).toBe("Ra8#");
  });

  it("steady opens like a sensible beginner", () => {
    const rand = seq(11);
    for (let i = 0; i < 20; i++) expect(["e4", "d4", "Nf3", "Nc3", "c4", "e3", "d3"]).toContain(chooseMove(START_FEN, "steady", rand)?.san);
  });

  it("returns null when there is nothing to play", () => {
    expect(chooseMove("R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1", "steady")).toBeNull();
  });
});

describe("Gym play", () => {
  const tap = (st: ReturnType<typeof startGame>, a: Square, b: Square, now = 0) => playReduce(playReduce(st, { type: "tap", square: a, now }), { type: "tap", square: b, now });

  it("plays vs a bot, takes back, resigns", () => {
    let s = startGame(defaultSetup("cody"), 0);
    s = tap(s, "e2", "e4");
    expect(s.history).toEqual(["e4"]);
    expect(s.botThinking).toBe(true);
    expect(playReduce(s, { type: "tap", square: "d2", now: 0 })).toBe(s);
    s = playReduce(s, { type: "bot", move: { from: "e7", to: "e5" }, now: 0 });
    s = playReduce(s, { type: "takeback", now: 0 });
    expect(s.history).toEqual(["e4"]);
    expect(s.botThinking).toBe(false);
    expect(playReduce(s, { type: "tap", square: "d2", now: 0 })).toBe(s);
    s = playReduce(s, { type: "redo", now: 0 });
    expect(s.history).toEqual(["e4", "e5"]);
    s = playReduce(s, { type: "resign", now: 0 });
    expect(playResult(s)).toBe("loss");
  });

  it("charges the running move's time when resigning", () => {
    let s = startGame({ ...defaultSetup("cody"), time: "5+3" }, 0);
    s = playReduce(s, { type: "resign", now: 20_000 });
    expect(s.clock?.w).toBe(280_000);
    expect(timeLeft(s, "w", 99_000)).toBe(280_000);
  });

  it("refuses take-backs when the setup turns them off", () => {
    let s = startGame({ ...defaultSetup("atlas"), takebacks: false }, 0);
    s = tap(s, "e2", "e4");
    s = playReduce(s, { type: "bot", move: { from: "e7", to: "e5" }, now: 0 });
    expect(playReduce(s, { type: "takeback", now: 0 })).toBe(s);
  });

  it("pass & play moves both sides and undoes one move at a time", () => {
    const setup: PlaySetup = { ...defaultSetup(), opponent: { kind: "friend" }, takebacks: true };
    let s = startGame(setup, 0);
    s = tap(s, "e2", "e4");
    expect(s.botThinking).toBe(false);
    s = tap(s, "e7", "e5");
    expect(s.history).toEqual(["e4", "e5"]);
    s = playReduce(s, { type: "takeback", now: 0 });
    expect(s.history).toEqual(["e4"]);
    s = playReduce(s, { type: "redo", now: 0 });
    expect(s.history).toEqual(["e4", "e5"]);
  });

  it("asks which piece to promote to", () => {
    let s = startGame({ ...defaultSetup(), opponent: { kind: "friend" }, startFen: "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1" }, 0);
    s = tap(s, "b7", "b8");
    expect(s.promotion).toEqual({ from: "b7", to: "b8" });
    s = playReduce(s, { type: "promote", piece: "n", now: 0 });
    expect(s.history).toEqual(["b8=N"]);
  });

  it("runs the clock with increment and flags on timeout", () => {
    let s = startGame({ ...defaultSetup(), opponent: { kind: "friend" }, time: "5+3" }, 1_000);
    expect(timeLeft(s, "w", 11_000)).toBe(290_000);
    s = tap(s, "e2", "e4", 11_000);
    expect(s.clock!.w).toBe(293_000);
    expect(timeLeft(s, "b", 11_000)).toBe(300_000);
    s = playReduce(s, { type: "tick", now: 11_000 + 300_001 });
    expect(s.over).toEqual({ kind: "timeout", loser: "b" });
    expect(playResult(s)).toBe("win");
  });

  it("makes legal Shuffle chess starts and loads every practice position", () => {
    const rand = seq(5);
    for (let i = 0; i < 20; i++) {
      const fen = shuffleFen(rand);
      const back = fen.split("/")[0];
      expect(back.indexOf("r")).toBeLessThan(back.indexOf("k"));
      expect(back.lastIndexOf("r")).toBeGreaterThan(back.indexOf("k"));
      expect(back.indexOf("b") % 2).not.toBe(back.lastIndexOf("b") % 2);
      expect(load(fen).moves().length).toBeGreaterThan(0);
    }
    for (const p of START_POSITIONS) expect(load(p.fen).moves().length, p.name).toBeGreaterThan(0);
  });

  it("detects a win by checkmate", () => {
    let s = startGame({ ...defaultSetup("rooky"), startFen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1" }, 0);
    s = tap(s, "a1", "a8");
    expect(playResult(s)).toBe("win");
  });
});

describe("the bot roster", () => {
  it("every bot plays legal moves quickly", () => {
    const rand = seq(9);
    for (const bot of BOTS) {
      let fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
      const t = Date.now();
      for (let i = 0; i < 4; i++) {
        const chess = load(fen);
        const m = chooseMove(fen, bot.id, rand)!;
        expect(chess.moves().includes(m.san), bot.name).toBe(true);
        chess.move(m.san);
        fen = chess.fen();
      }
      expect(Date.now() - t, bot.name).toBeLessThan(9_000);
    }
  }, 30_000);

  it("stronger bots find mates and win material", () => {
    for (const id of ["bishop", "ivy", "atlas"] as const) {
      expect(chooseMove("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", id, seq())?.san, id).toBe("Ra8#");
      expect(chooseMove("4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1", id, seq())?.san, id).toBe("Qxd5");
    }
    // Mate in two: Atlas sees it.
    expect(chooseMove("1k6/8/2K5/8/8/8/8/7Q w - - 0 1", "atlas", seq())?.san).toMatch(/^Q/);
  });
});

describe("puzzles", () => {
  it("bundles a validated, rated pack", () => {
    const all = allPuzzles();
    expect(all.length).toBeGreaterThan(1000);
    expect(all.every((p) => p.moves.length >= 2 && p.rating >= 400 && p.rating < 2000)).toBe(true);
  });

  it("solves a puzzle by following its line, and fails on a wrong move", () => {
    const p = allPuzzles()[0];
    let s = puzzleReduce(startPuzzle(p), { type: "setup" });
    expect(s.status).toBe("solving");
    for (let guard = 0; s.status !== "solved" && guard < 10; guard++) {
      if (s.status === "reply") s = puzzleReduce(s, { type: "reply" });
      else {
        const m = p.moves[s.step];
        s = pMove(s, m.slice(0, 2) as Square, m.slice(2, 4) as Square, (m[4] as PromotionPiece) || "q");
      }
    }
    expect(s.status).toBe("solved");
    expect(s.missed).toBe(false);

    let w = puzzleReduce(startPuzzle(p), { type: "setup" });
    const right = p.moves[1];
    const wrong = load(w.fen).moves({ verbose: true }).find((m) => `${m.from}${m.to}` !== right.slice(0, 4) && !m.san.endsWith("#"))!;
    w = pMove(w, wrong.from as Square, wrong.to as Square);
    expect(w.status).toBe("failed");
    const shown = puzzleReduce(w, { type: "solution" });
    expect(shown.step).toBe(p.moves.length);
    expect(shown.status).toBe("failed");
    w = puzzleReduce(w, { type: "retry" });
    expect(w.status).toBe("solving");
    expect(w.missed).toBe(true);
  });

  it("every bundled puzzle is solvable from its first move", () => {
    for (const p of allPuzzles().slice(0, 300)) {
      let s = puzzleReduce(startPuzzle(p), { type: "setup" });
      for (let guard = 0; s.status !== "solved" && s.status !== "failed" && guard < 10; guard++) {
        if (s.status === "reply") s = puzzleReduce(s, { type: "reply" });
        else {
          const m = p.moves[s.step];
          s = pMove(s, m.slice(0, 2) as Square, m.slice(2, 4) as Square, (m[4] as PromotionPiece) || "q");
        }
      }
      expect(s.status, p.id).toBe("solved");
    }
  });

  it("picks near your rating, has a stable daily puzzle and updates ratings", () => {
    const p = nextPuzzle({ rating: 900, rand: seq() });
    expect(Math.abs(p.rating - 900)).toBeLessThanOrEqual(100);
    expect(nextPuzzle({ rating: 900, theme: "fork", rand: seq() }).themes).toContain("fork");
    expect(dailyPuzzle("2026-11-04").id).toBe(dailyPuzzle("2026-11-04", [], []).id);
    expect(updateRating(600, 600, true, 0)).toBe(620);
    expect(updateRating(600, 600, false, 0)).toBe(580);
  });
});

describe("game review", () => {
  it("steps through a game and flags a hung queen", () => {
    const plies = reviewPlies(START_FEN, ["e4", "e5", "Qh5", "Nc6", "Qxe5+", "Nxe5"]);
    expect(plies).toHaveLength(6);
    expect(plies[4].san).toBe("Qxe5+");
    const note = assessMove(plies[4]);
    expect(note.verdict).toBe("blunder");
    expect(note.better).not.toBeNull();
    expect(assessMove(plies[0]).verdict).toBe("good");
    expect(note.betterMove).not.toBeNull();
    expect(note.evalAfter).toBeLessThan(-300);
  });

  it("sums up a game: accuracy, counts, key moments", () => {
    const plies = reviewPlies(START_FEN, ["f3", "e5", "g4", "Qh4#"]);
    const notes = Object.fromEntries(plies.map((p) => [p.ply, assessMove(p)]));
    const white = summarise(plies, notes, "w");
    expect(white.counts.good + white.counts.inaccuracy + white.counts.mistake + white.counts.blunder).toBe(2);
    expect(white.moments.some((m) => m.ply === 3 && m.kind !== "great")).toBe(true);
    expect(white.accuracy).toBeLessThan(80);
    const black = summarise(plies, notes, "b");
    expect(black.moments.at(-1)).toEqual({ ply: 4, kind: "mate" });
    expect(black.accuracy).toBeGreaterThan(white.accuracy);
    expect(summarise(plies, {}, null).accuracy).toBe(0);
  });

  it("names move sounds and counts material", () => {
    expect(["e4", "Nxe5", "Qh5+", "Qxf7#", "O-O", "O-O-O", "e8=Q"].map(moveCue)).toEqual(["move", "capture", "check", "mate", "castle", "castle", "promote"]);
    expect(materialEdge(START_FEN)).toBe(0);
    expect(materialEdge("4k3/8/8/8/8/8/8/R3K3 w - - 0 1")).toBe(5);
    expect([0, 140, -60, 99999].map(formatEval)).toEqual(["0.0", "+1.4", "−0.6", "+M"]);
  });

  it("lets the learner try the better move", () => {
    let t = startTry(START_FEN, { from: "e2", to: "e4" });
    t = tryReduce(t, "d2");
    expect(t.targets).toContain("d4");
    t = tryReduce(t, "d4");
    expect(t.status).toBe("wrong");
    expect(t.misses).toBe(1);
    expect(tryReduce(t, "e7").selected).toBeNull();
    t = tryReduce(tryReduce(t, "e2"), "e4");
    expect(t.status).toBe("right");
    expect(t.fen.split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR");
  });
});

describe("daily puzzle", () => {
  const day = "2026-11-04";

  it("is deterministic for the same day, themes and seen list", () => {
    const themes = ["fork", "pin"];
    const seen = ["abc12"];
    expect(dailyPuzzle(day, themes, seen).id).toBe(dailyPuzzle(day, themes, [...seen]).id);
    const ids = new Set<string>();
    for (let d = 1; d <= 24; d++) ids.add(dailyPuzzle(`2026-03-${String(d).padStart(2, "0")}`, themes, []).id);
    expect(ids.size).toBeGreaterThan(1);
  });

  it("stays inside the completed themes and never repeats a served id", () => {
    expect(themesForCompletedLessons(["meet", "board", "forks", "pins", "forks"])).toEqual(["fork", "pin"]);
    expect(themesForCompletedLessons(["meet", "board"])).toEqual([]);
    const themes = themesForCompletedLessons(["forks"]);
    const first = dailyPuzzle(day, themes, []);
    expect(first.themes).toContain("fork");
    const second = dailyPuzzle(day, themes, [first.id]);
    expect(second.id).not.toBe(first.id);
    expect(second.themes).toContain("fork");
    const again = dailyPuzzle(day, themes, [second.id, first.id]);
    expect([first.id, second.id]).not.toContain(again.id);
  });

  it("falls back to the date-seeded puzzle when nothing is completed or the pool is used up", () => {
    const seeded = dailyPuzzle(day);
    expect(dailyPuzzle(day, [], ["zzzzz"]).id).toBe(seeded.id);
    expect(dailyPuzzle(day, ["not-a-theme"], []).id).toBe(seeded.id);
    const forks = allPuzzles().filter((p) => p.themes.includes("fork")).map((p) => p.id);
    expect(forks.length).toBeGreaterThan(1);
    expect(dailyPuzzle(day, ["fork"], forks).id).toBe(seeded.id);
  });
});

describe("piece sets", () => {
  it("keeps ChessSchool sets and migrates removed Lichess sets to Toy", () => {
    expect(PIECE_SETS.map((s) => s.id)).toEqual(["toy", "clay", "pixel", "outline"]);
    expect(PIECE_SETS.every((s) => s.source === "chessschool")).toBe(true);
    expect(migratePieceSet("pixel")).toBe("pixel");
    expect(migratePieceSet("outline")).toBe("outline");
    expect(migratePieceSet("clay")).toBe("clay");
    expect(migratePieceSet("toy")).toBe("toy");
    for (const id of ["spatial", "arcade", "bold", "heritage", "cartoon", "fantasy", "chessnut", "dubrovny", "kiwen-suwi"]) {
      expect(isRemovedPieceSet(id)).toBe(true);
      expect(migratePieceSet(id)).toBe("toy");
    }
    expect(migratePieceSet("pixel")).toBe("pixel");
    expect(isRemovedPieceSet("pixel")).toBe(false);
    expect(migratePieceSet(null)).toBe("toy");
    expect(migratePieceSet("nope")).toBe("toy");
  });

  it("draws every piece in every set", () => {
    for (const set of PIECE_SETS) {
      for (const c of ["w", "b"] as const) {
        for (const t of ["k", "q", "r", "b", "n", "p"] as const) {
          const a = pieceArtwork(set.id, c, t);
          if (a.kind === "vector") expect(a.drawing.ops.length, `${set.id} ${c}${t}`).toBeGreaterThan(0);
          else expect(a.asset).toBe(`${set.id}/${c}${t.toUpperCase()}`);
        }
      }
    }
  });
});
