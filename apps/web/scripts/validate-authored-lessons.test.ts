import { describe, expect, it } from "vitest";
import {
  checkBishopSquareColourCoach,
  squareColor,
  validateAuthoredLessons,
} from "./validate-authored-lessons.mjs";

describe("squareColor", () => {
  it("treats a1 and c1 as dark squares", () => {
    expect(squareColor("a1")).toBe("dark");
    expect(squareColor("c1")).toBe("dark");
    expect(squareColor("f1")).toBe("light");
  });
});

describe("checkBishopSquareColourCoach", () => {
  it("flags wrong square colour in coach copy", () => {
    const issues = checkBishopSquareColourCoach(
      "t",
      "s",
      "This bishop on c1 stays on light squares its whole life.",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("bishop_square_colour");
  });

  it("accepts correct dark-square copy for c1", () => {
    const issues = checkBishopSquareColourCoach(
      "t",
      "s",
      "This bishop on c1 stays on dark squares its whole life.",
    );
    expect(issues).toHaveLength(0);
  });
});

describe("validateAuthoredLessons", () => {
  it("passes with zero errors on curated lesson bank", () => {
    const { errors } = validateAuthoredLessons();
    expect(errors).toEqual([]);
  });

  it("regression: pre-bishop-diagonal-info coach matches c1 square colour", () => {
    const { errors } = validateAuthoredLessons();
    const hit = errors.filter((e) => e.lessonId === "pre-bishop-diagonal-info");
    expect(hit).toEqual([]);
  });
});
