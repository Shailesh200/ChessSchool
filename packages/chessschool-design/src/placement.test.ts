import { describe, expect, it } from "vitest";
import { createInitialState, placeBefore, placementStart } from "./progress";

const order = ["meet", "board", "moves", "check", "forks", "pins", "ladder"];
const items = ["check", "forks", "ladder"];

describe("placement quiz", () => {
  it("starts at the first missed item, or after the last one", () => {
    expect(placementStart(order, items, 0)).toBe("check");
    expect(placementStart(order, items, 1)).toBe("forks");
    expect(placementStart(order, items, null)).toBeNull();
    expect(placementStart([...order, "next"], items, null)).toBe("next");
  });

  it("marks earlier lessons as known without XP and lifts the starting puzzle rating", () => {
    const s = placeBefore(createInitialState("g"), order, "forks", new Date("2026-11-14T10:00:00"));
    expect(Object.keys(s.progress.completed)).toEqual(["meet", "board", "moves", "check"]);
    expect(s.progress.placed).toEqual(["meet", "board", "moves", "check"]);
    expect(s.progress.xp).toBe(0);
    expect(s.placementDone).toBe(true);
    expect(s.progress.puzzles.rating).toBeGreaterThan(600);
  });
});

describe("endgame trainer", () => {
  it("counts wins per start position toward mastery", async () => {
    const { recordGame } = await import("./progress");
    const setup = { opponent: { kind: "bot" as const, bot: "cody" }, you: "w" as const, time: "none", startFen: "x", startId: "lucena", takebacks: false, askPromotion: true };
    let s = createInitialState("g");
    s = recordGame(s, { id: "1", endedAt: 1, setup, history: [], winner: "w", reason: "checkmate" }, new Date(), 3);
    s = recordGame(s, { id: "2", endedAt: 2, setup, history: [], winner: "b", reason: "checkmate" }, new Date(), 3);
    expect(s.endgames).toEqual({ lucena: 1 });
  });
});
