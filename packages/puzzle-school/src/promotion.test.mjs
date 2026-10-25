import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBank } from "./bank.mjs";
import { compilePuzzleSteps } from "./compile-lesson.mjs";
import { validateLessonSteps } from "./validate.mjs";

const bankDir = join(dirname(fileURLToPath(import.meta.url)), "../data/puzzles");

/** Student plies are the odd indexes (line[0] is the opponent's setup move). */
function studentPlies(line) {
  const moves = line.map((m) => String(m).replace(/:/g, ""));
  const out = [];
  for (let i = 1; i < moves.length; i += 2) out.push(moves[i]);
  return out;
}

describe("promotion piece in compiled steps", () => {
  const puzzles = loadBank(bankDir);
  const under = [];
  for (const puzzle of puzzles) {
    const plies = studentPlies(puzzle.line ?? []);
    plies.forEach((uci, index) => {
      if (uci.length > 4 && uci[4] !== "q")
        under.push({ puzzle, uci, index, piece: uci[4] });
    });
  }

  it("enumerates every underpromotion and keeps the non-queen piece", () => {
    const ids = under.map((row) => row.puzzle.id);
    assert.ok(
      ids.includes("cs-pz-expert-fork-0006"),
      "fork underpromotion missing from the bank",
    );
    assert.ok(under.length > 0);

    for (const row of under) {
      const compiled = compilePuzzleSteps(row.puzzle);
      assert.ok(!("error" in compiled), `${row.puzzle.id} ${compiled.error ?? ""}`);
      const step = compiled.steps[row.index];
      const from = row.uci.slice(0, 2);
      const to = row.uci.slice(2, 4);
      assert.equal(step.solution[0], `${from}:${to}`, row.puzzle.id);
      assert.equal(step.promotion, row.piece, `${row.puzzle.id} ${row.uci}`);
      const { errors } = validateLessonSteps(row.puzzle.id, [step]);
      assert.equal(
        errors.filter((e) => e.reason === "missing_promotion").length,
        0,
        row.puzzle.id,
      );
      const stripped = { ...step, promotion: undefined };
      const missing = validateLessonSteps(row.puzzle.id, [stripped]);
      assert.ok(
        missing.errors.some((e) => e.reason === "missing_promotion"),
        `${row.puzzle.id} should fail without a piece`,
      );
    }
  });
});
