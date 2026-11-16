import { describe, expect, it } from "vitest";
import { accuracy, elapsedSeconds, isComboBeat, isPerfect, mateGrid, mateShareText, startTally, tallyAfter, tallyMiss, tallyStep } from "./flow";

describe("lesson flow", () => {
  it("counts runs in a row, resets on a miss, and knows a perfect lesson", () => {
    let t = startTally(0);
    t = tallyStep(tallyStep(tallyStep(t, true), true), true);
    expect(t).toMatchObject({ combo: 3, best: 3 });
    expect(isComboBeat(t.combo)).toBe(true);
    expect(isPerfect(t)).toBe(true);
    t = tallyMiss(t);
    t = tallyStep(t, false);
    expect(t).toMatchObject({ combo: 0, best: 3, solved: 4, clean: 3 });
    expect(isPerfect(t)).toBe(false);
    expect(accuracy(t)).toBe(75);
    expect(elapsedSeconds(t, 95_400)).toBe(95);
    expect(isPerfect(startTally(0))).toBe(false);
  });
});

describe("tallyAfter", () => {
  const r = (status: string, misses = 0, showHint = false) => ({ status, misses, showHint });
  it("counts a clean solve, a solve after a miss or a hint as not clean, and a miss as the end of a run", () => {
    let t = tallyAfter(startTally(0), r("working"), r("ready"), 0);
    expect(t).toMatchObject({ solved: 1, clean: 1, combo: 1 });
    t = tallyAfter(t, r("working", 0), r("working", 1), 0);
    expect(t.combo).toBe(0);
    t = tallyAfter(t, r("working", 1), r("ready", 1), 0);
    expect(t).toMatchObject({ solved: 2, clean: 1 });
    t = tallyAfter(t, r("working", 1, true), r("ready", 1, true), 1);
    expect(t).toMatchObject({ solved: 3, clean: 1 });
    expect(tallyAfter(t, r("ready"), r("working"), 1)).toBe(t);
  });
});

describe("mate of the day share", () => {
  it("is an emoji grid and a link, with no move notation", () => {
    const text = mateShareText("2026-11-16", [[true, false], [true, true]], "ChessSchool mate of the day 2026-11-16", "Solved in 2 tries");
    expect(text).toBe("ChessSchool mate of the day 2026-11-16\nSolved in 2 tries\n🟩🟥\n🟩🟩\n⬜⬜\nhttps://chess-school.in/mate/2026-11-16");
    const body = text.split("\n").slice(1, -1).join("\n");
    expect(body).not.toMatch(/[a-h][1-8]|[KQRBN]x?[a-h]|O-O|#|\+/);
    expect(mateGrid([[false]])).toBe("🟥⬜\n⬜⬜\n⬜⬜");
  });
});
