import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compiledPromotionErrors, validateLessonSteps, validatePreschoolSpine } from "./validate.mjs";
import { topicIndex, preschoolTopicForLesson } from "../data/preschool-spine.mjs";

describe("validateLessonSteps", () => {
  it("accepts a legal move step", () => {
    const { errors } = validateLessonSteps("t", [
      {
        id: "m1",
        kind: "move",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        solution: ["e7:e5"],
        coach: "Black can push the e-pawn.",
      },
    ]);
    assert.equal(errors.length, 0);
  });

  it("rejects a promoting solution that does not name the piece", () => {
    const { errors } = validateLessonSteps("t", [
      {
        id: "m1",
        kind: "move",
        fen: "8/4P3/8/8/8/8/8/4K2k w - - 0 1",
        solution: ["e7:e8"],
        coach: "Promote the pawn.",
      },
    ]);
    assert.ok(errors.some((e) => e.reason === "missing_promotion"));
  });

  it("accepts a promoting solution that names the piece", () => {
    const { errors } = validateLessonSteps("t", [
      {
        id: "m1",
        kind: "move",
        fen: "8/4P3/8/8/8/8/8/4K2k w - - 0 1",
        solution: ["e7:e8"],
        promotion: "q",
        coach: "Promote the pawn to a queen.",
      },
    ]);
    assert.equal(errors.length, 0);
  });

  it("accepts different pieces via promotions and rejects a conflicting scalar", () => {
    const fen = "8/P3P3/8/8/8/8/8/4K2k w - - 0 1";
    const base = {
      id: "m1",
      kind: "move",
      fen,
      solution: ["e7:e8", "a7:a8"],
      coach: "Either pawn can promote.",
    };
    const ok = validateLessonSteps("t", [
      { ...base, promotions: { "e7:e8": "q", "a7:a8": "n" } },
    ]);
    assert.equal(ok.errors.length, 0);
    const mixed = validateLessonSteps("t", [
      { ...base, promotion: "q", promotions: { "a7:a8": "n" } },
    ]);
    assert.ok(mixed.errors.some((e) => e.reason === "mixed_promotion"));
  });

  it("rejects a promotion piece on a move that does not promote", () => {
    const { errors } = validateLessonSteps("t", [
      {
        id: "m1",
        kind: "move",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        solution: ["e7:e5"],
        promotion: "q",
        coach: "Black can push the e-pawn.",
      },
    ]);
    assert.ok(errors.some((e) => e.reason === "unexpected_promotion"));
  });

  it("rejects illegal move", () => {
    const { errors } = validateLessonSteps("t", [
      {
        id: "m1",
        kind: "move",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        solution: ["e2:e5"],
        coach: "nope",
      },
    ]);
    assert.ok(errors.some((e) => e.reason === "illegal_move"));
  });
});

describe("compiledPromotionErrors", () => {
  it("requires the UCI piece on the compiled step and ignores non-promoting plies", () => {
    const puzzle = { line: ["e7e5", "e2e1q", "a7a6", "d2d4"] };
    const steps = [
      { id: "m1", promotion: "q", solution: ["e2:e1"] },
      { id: "m3", solution: ["d2:d4"] },
    ];
    assert.equal(compiledPromotionErrors(puzzle, steps).length, 0);
    assert.ok(
      compiledPromotionErrors(puzzle, [{ id: "m1", solution: ["e2:e1"] }, steps[1]]).some(
        (e) => e.reason === "missing_promotion",
      ),
    );
    assert.ok(
      compiledPromotionErrors(puzzle, [
        steps[0],
        { id: "m3", solution: ["d2:d4"], promotion: "q" },
      ]).some((e) => e.reason === "unexpected_promotion"),
    );
  });
});

describe("validatePreschoolSpine", () => {
  it("flags castling prerequisite before pawn moves", () => {
    const index = new Map([
      ["pre-moves-e4", { id: "pre-moves-e4", tag: "preschool", prerequisites: ["pre-rules-castling-quiz"] }],
      ["pre-rules-castling-quiz", { id: "pre-rules-castling-quiz", tag: "preschool", prerequisites: [] }],
    ]);
    const { errors } = validatePreschoolSpine(
      index,
      index.get("pre-moves-e4"),
      preschoolTopicForLesson,
      topicIndex,
    );
    assert.ok(errors.some((e) => e.reason === "spine_violation"));
  });
});
