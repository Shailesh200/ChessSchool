import { describe, expect, it } from "vitest";
import { lessonDisplayXp, lessonXpSummary } from "./lessonXp";

describe("lessonDisplayXp (08 lesson complete)", () => {
  it("shows no XP when zero puzzles were correct", () => {
    expect(lessonDisplayXp(0)).toBe(0);
    expect(lessonXpSummary(0, 2)).toBeNull();
  });

  it("awards +10 XP per correct puzzle", () => {
    expect(lessonDisplayXp(1)).toBe(10);
    expect(lessonDisplayXp(2)).toBe(20);
    expect(lessonXpSummary(2, 2)).toBe("2 puzzles × +10 XP = 20 XP");
  });
});
