import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeQuizLabel, validateQuizStep } from "./quiz-validate.mjs";

describe("validateQuizStep", () => {
  it("flags case-insensitive duplicate labels", () => {
    const errors = validateQuizStep("q1", {
      kind: "quiz",
      question: "Pick one",
      options: [
        { label: "e4", emoji: "♟️" },
        { label: "Pe4", emoji: "🅿️" },
        { label: "E4", emoji: "🔤" },
        { label: "d4", emoji: "♟️" },
      ],
      correct: 0,
      explain: "Pawns write only the destination square.",
      failText: "Try again.",
    });
    assert.ok(errors.some((e) => e.reason === "quiz_duplicate_option"));
  });

  it("accepts a well-formed preschool quiz", () => {
    const errors = validateQuizStep("q1", {
      kind: "quiz",
      question: "How many pawns?",
      options: [
        { label: "Eight", emoji: "8️⃣" },
        { label: "Two", emoji: "2️⃣" },
      ],
      correct: 0,
      explain: "Eight pawns each.",
      failText: "Count the pawn row.",
    });
    assert.equal(errors.length, 0);
  });
});

describe("normalizeQuizLabel", () => {
  it("lowercases and trims", () => {
    assert.equal(normalizeQuizLabel("  E4 "), "e4");
  });
});
