import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateLessonSteps, validatePreschoolSpine } from "./validate.mjs";
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
