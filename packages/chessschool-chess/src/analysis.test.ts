import { describe, expect, it } from "vitest";
import {
  analysisStepper,
  editorFen,
  editorFrom,
  EMPTY_FEN,
  evaluationLabel,
  goLine,
  lineFen,
  lineFromMoves,
  numberedLine,
  placePiece,
  positionProblem,
  promoteLine,
  readPastedFen,
  redoLine,
  runAnalysis,
  startLine,
  tapLine,
  undoLine,
} from "./analysis";
import { START_FEN } from "./board";
import { sharedDailyPuzzle } from "./puzzles";

const finish = (fen: string, maxDepth = 3) => {
  const s = analysisStepper(fen, { maxDepth, stepMs: 200 });
  let guard = 0;
  while (s.step() && guard++ < 10_000);
  return s.result!;
};

describe("position editor", () => {
  it("round-trips the start position and drops castling the pieces do not allow", () => {
    expect(editorFen(editorFrom(START_FEN))).toBe(START_FEN);
    const noRook = placePiece(editorFrom(START_FEN), "h1", null);
    expect(editorFen(noRook).split(" ")[2]).toBe("Qkq");
  });

  it("places, toggles off, and keeps one king per colour", () => {
    let s = editorFrom(EMPTY_FEN);
    s = placePiece(s, "e1", { type: "k", color: "w" });
    s = placePiece(s, "g1", { type: "k", color: "w" });
    expect([...s.pieces.keys()]).toEqual(["g1"]);
    s = placePiece(s, "g1", { type: "k", color: "w" });
    expect(s.pieces.size).toBe(0);
  });

  it("explains positions that cannot be played", () => {
    expect(positionProblem(START_FEN)).toBeNull();
    expect(positionProblem("8/8/8/8/8/8/8/4K3 w - - 0 1")).toBe("kings");
    expect(positionProblem("4k3/8/8/8/8/8/8/P3K3 w - - 0 1")).toBe("pawns");
    // White to move while Black is in check from the rook: Black could not have left it.
    expect(positionProblem("4k3/8/8/8/8/8/8/4KR2 w - - 0 1")).toBeNull();
    expect(positionProblem("4k3/4R3/8/8/8/8/8/4K3 w - - 0 1")).toBe("check");
  });

  it("completes a pasted board-only FEN and refuses junk", () => {
    expect(readPastedFen("4k3/8/8/8/8/8/8/4K3")).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(readPastedFen("  4k3/8/8/8/8/8/8/4K3 b - - 3 40 ")).toBe("4k3/8/8/8/8/8/8/4K3 b - - 3 40");
    expect(readPastedFen("hello")).toBeNull();
    expect(readPastedFen("4k3/8/8/8/8/8/8/4K4")).toBeNull();
  });
});

describe("analysis line", () => {
  it("plays both sides by tapping, with undo, redo and a new branch", () => {
    let l = startLine();
    l = tapLine(tapLine(l, "e2"), "e4");
    l = tapLine(tapLine(l, "e7"), "e5");
    expect(l.moves.map((m) => m.san)).toEqual(["e4", "e5"]);
    l = undoLine(l);
    expect(lineFen(l)).toBe(l.moves[0].fen);
    l = redoLine(l);
    expect(l.at).toBe(2);
    l = tapLine(tapLine(undoLine(l), "c7"), "c5");
    expect(l.moves.map((m) => m.san)).toEqual(["e4", "c5"]);
    expect(goLine(l, 99).at).toBe(2);
  });

  it("refuses an illegal move and asks before promoting", () => {
    let l = tapLine(tapLine(startLine(), "e2"), "e5");
    expect(l.moves).toHaveLength(0);
    l = tapLine(tapLine(startLine("8/P6k/8/8/8/8/8/K7 w - - 0 1"), "a7"), "a8");
    expect(l.promotion).toEqual({ from: "a7", to: "a8" });
    l = promoteLine(l, "n");
    expect(l.moves[0].san).toBe("a8=N");
  });

  it("opens a game on a chosen move", () => {
    const l = lineFromMoves(START_FEN, ["e4", "e5", "Nf3", "bogus", "Nc6"], 1);
    expect(l.moves).toHaveLength(3);
    expect(l.at).toBe(1);
  });
});

describe("engine evaluation", () => {
  it("finds a mate in one and reports it as a mate for the side to move", () => {
    const r = finish("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", 2);
    expect(r.best[0]).toBe("Ra8#");
    expect(r.mate).toBe(1);
    expect(evaluationLabel(r)).toBe("M1");
    const b = finish("r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1", 2);
    expect(b.mate).toBe(-1);
    expect(evaluationLabel(b)).toBe("−M1");
  });

  it("sees a free queen and gives a best line from the position", () => {
    const r = finish("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1", 2);
    expect(r.best[0]).toBe("Rxd5");
    expect(r.cp).toBeGreaterThan(300);
    expect(r.best.length).toBeGreaterThan(1);
  });

  it("reports a finished game without searching", () => {
    expect(finish("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").over).toBe("stalemate");
    expect(evaluationLabel(finish("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"))).toBe("#");
  });

  it("runs in slices on a scheduler and stops when cancelled", () => {
    const queue: (() => void)[] = [];
    const schedule = (fn: () => void) => {
      queue.push(fn);
      return () => {};
    };
    const seen: boolean[] = [];
    runAnalysis(START_FEN, schedule, (_e, done) => seen.push(done), { maxDepth: 1, sliceMs: 5 });
    let guard = 0;
    while (queue.length && guard++ < 10_000) queue.shift()!();
    expect(seen.at(-1)).toBe(true);
    const stop = runAnalysis(START_FEN, schedule, () => seen.push(false), { maxDepth: 1 });
    const before = seen.length;
    stop();
    while (queue.length) queue.shift()!();
    expect(seen.length).toBe(before);
  });

  it("numbers a best line from either side", () => {
    expect(numberedLine(START_FEN, ["e4", "e5", "Nf3"])).toBe("1. e4 e5 2. Nf3");
    expect(numberedLine("4k3/8/8/8/8/8/8/4K3 b - - 0 12", ["Kd7", "Kd2"])).toBe("12… Kd7 13. Kd2");
  });
});

describe("shared daily puzzle", () => {
  it("is the same for any order of the same pack and changes with the day", () => {
    const pack = Array.from({ length: 40 }, (_, i) => ({ id: `p${String(i).padStart(3, "0")}`, rating: 800 + i * 10 }));
    const a = sharedDailyPuzzle("2026-11-20", pack);
    const b = sharedDailyPuzzle("2026-11-20", [...pack].reverse());
    expect(a?.id).toBe(b?.id);
    const days = new Set(Array.from({ length: 10 }, (_, d) => sharedDailyPuzzle(`2026-11-${String(d + 10)}`, pack)?.id));
    expect(days.size).toBeGreaterThan(3);
    expect(sharedDailyPuzzle("2026-11-20", [])).toBeNull();
  });
});
