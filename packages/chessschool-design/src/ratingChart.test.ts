import { describe, expect, it } from "vitest";
import { keyMomentText } from "./keyMoment";
import { nextRatingMilestone, ratingChart } from "./ratingChart";

describe("rating chart", () => {
  it("draws one line through every point with a milestone line per hundred", () => {
    const c = ratingChart([{ at: 1, rating: 820 }, { at: 2, rating: 905 }, { at: 3, rating: 1010 }], 200, 100, 10);
    expect([c.min, c.max]).toEqual([800, 1100]);
    expect(c.lines.map((l) => l.value)).toEqual([800, 900, 1000, 1100]);
    expect(c.dots).toHaveLength(3);
    expect(c.dots[0].x).toBe(10);
    expect(c.dots[2].x).toBe(190);
    expect(c.dots[0].y).toBeGreaterThan(c.dots[2].y); // higher rating is higher up
    expect(c.path).toBe(`M${c.dots[0].x} ${c.dots[0].y} L${c.dots[1].x} ${c.dots[1].y} L${c.dots[2].x} ${c.dots[2].y}`);
  });

  it("handles no points, one point and a flat rating", () => {
    expect(ratingChart([], 200, 100).path).toBe("");
    expect(ratingChart([{ at: 1, rating: 800 }], 200, 100).dots).toEqual([{ x: 100, y: 92 }]);
    const flat = ratingChart([{ at: 1, rating: 800 }, { at: 2, rating: 800 }], 200, 100);
    expect([flat.min, flat.max]).toEqual([800, 900]);
  });

  it("names the next milestone", () => {
    expect([799, 800, 950].map(nextRatingMilestone)).toEqual([800, 900, 1000]);
  });
});

describe("key moment text", () => {
  const mistake = { kind: "mistake" as const, verdict: "blunder" as const, better: "Nf3", tags: ["fork"] };
  it("prefers the coach note, then the detector tag, then the review's words", () => {
    expect(keyMomentText(mistake, " The knight was loose. ")).toBe("The knight was loose.");
    expect(keyMomentText(mistake)).toBe("A fork was there: one move, two targets.");
    expect(keyMomentText({ ...mistake, tags: [] })).toContain("Nf3");
    expect(keyMomentText({ kind: "great", verdict: "good", better: null, tags: [] })).toBe("This move turned the game your way.");
  });
});
