import { describe, expect, it } from "vitest";
import { addFreezes, weekCard } from "./growth";
import { completeNode, createInitialState, FREEZE_MAX } from "./progress";

describe("growth helpers", () => {
  it("counts the last 7 days of lessons for the weekly card", () => {
    let s = completeNode(createInitialState("g"), "meet", new Date("2026-11-01T10:00:00"));
    s = completeNode(s, "board", new Date("2026-11-12T10:00:00"));
    s = completeNode(s, "moves", new Date("2026-11-16T10:00:00"));
    expect(weekCard(s.progress, new Date("2026-11-16T12:00:00"))).toEqual({ lessons: 2, puzzles: 0, streak: s.progress.streak.count });
  });

  it("adds invite freezes up to FREEZE_MAX and no further", () => {
    const s = createInitialState("g");
    expect(addFreezes(s, 0)).toBe(s);
    expect(addFreezes(s, 1).progress.streak.freezes).toBe(1);
    expect(addFreezes(addFreezes(s, 2), 2).progress.streak.freezes).toBe(FREEZE_MAX);
  });
});
