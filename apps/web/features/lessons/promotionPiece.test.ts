import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBank } from "@chess-school/puzzle-school/bank";
import { compilePuzzleSteps } from "@chess-school/puzzle-school";
import {
  matchesSolution,
  type PromotionPiece,
  type SolutionLike,
} from "@chess-school/progression";
import { LESSONS } from "./curriculum";

type BankPuzzle = {
  id: string;
  fen: string;
  line: string[];
  concepts: string[];
};

const bankDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/puzzle-school/data/puzzles",
);

function studentPlies(line: string[]): string[] {
  const moves = line.map((m) => m.replace(/:/g, ""));
  const out: string[] = [];
  for (let i = 1; i < moves.length; i += 2) out.push(moves[i]!);
  return out;
}

describe("promotion piece", () => {
  it("rejects a knight on a promote-to-queen lesson step", () => {
    for (const id of ["pre-moves-promotion", "endgame-promotion"]) {
      const lesson = LESSONS.find((l) => l.id === id);
      const step = lesson?.steps.find((s) => s.kind === "move");
      expect(step?.solution, id).toEqual(["e7:e8"]);
      expect(step?.promotion, id).toBe("q");
      expect(matchesSolution(step!, { from: "e7", to: "e8", promotion: "n" }), id).toBe(
        false,
      );
      expect(matchesSolution(step!, { from: "e7", to: "e8", promotion: "q" }), id).toBe(
        true,
      );
    }
  });

  it("rejects a queen on every underpromotion in the bank", () => {
    const puzzles = loadBank(bankDir) as BankPuzzle[];
    const seen: string[] = [];
    for (const puzzle of puzzles) {
      const plies = studentPlies(puzzle.line ?? []);
      const hits = plies.flatMap((uci, index) =>
        uci.length > 4 && uci[4] !== "q" ? [{ uci, index, piece: uci[4]! }] : [],
      );
      if (!hits.length) continue;
      seen.push(puzzle.id);
      const compiled = compilePuzzleSteps(puzzle);
      expect("steps" in compiled, puzzle.id).toBe(true);
      if (!("steps" in compiled)) continue;
      for (const hit of hits) {
        const step = compiled.steps[hit.index] as SolutionLike;
        const from = hit.uci.slice(0, 2);
        const to = hit.uci.slice(2, 4);
        const piece = hit.piece as PromotionPiece;
        expect(step.solution, puzzle.id).toEqual([`${from}:${to}`]);
        expect(step.promotion, `${puzzle.id} ${hit.uci}`).toBe(piece);
        expect(
          matchesSolution(step, { from, to, promotion: "q" }),
          `${puzzle.id} queen`,
        ).toBe(false);
        expect(
          matchesSolution(step, { from, to, promotion: piece }),
          `${puzzle.id} ${piece}`,
        ).toBe(true);
      }
    }
    expect(seen).toContain("cs-pz-expert-fork-0006");
  });
});
