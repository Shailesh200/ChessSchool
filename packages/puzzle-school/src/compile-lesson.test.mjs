import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compilePuzzleSteps } from "./compile-lesson.mjs";

const sample = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../data/puzzles/elementary/mate.jsonl"),
    "utf8",
  ).split("\n")[0],
);

describe("compilePuzzleSteps", () => {
  it("compiles a real bank puzzle", () => {
    const result = compilePuzzleSteps(sample);
    assert.ok("steps" in result);
    assert.ok(result.steps.length >= 1);
    assert.equal(result.steps[0].kind, "move");
  });

  it("rejects illegal lines", () => {
    const result = compilePuzzleSteps({
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      line: ["e2e9", "d7d5"],
      concepts: ["fork"],
    });
    assert.ok("error" in result);
  });
});
