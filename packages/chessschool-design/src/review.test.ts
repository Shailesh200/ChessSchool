import { describe, expect, it } from "vitest";
import { dueReviews, reviewAfter } from "./review";

describe("spaced review", () => {
  it("brings a miss back after 1, 3 and 7 days, then retires it", () => {
    let r = reviewAfter({}, "fork:3", true, "2026-11-14");
    expect(r["fork:3"]).toEqual({ due: "2026-11-15", box: 0 });
    expect(dueReviews(r, "2026-11-14")).toEqual([]);
    expect(dueReviews(r, "2026-11-15")).toEqual(["fork:3"]);
    r = reviewAfter(r, "fork:3", false, "2026-11-15");
    expect(r["fork:3"]).toEqual({ due: "2026-11-18", box: 1 });
    r = reviewAfter(r, "fork:3", false, "2026-11-18");
    expect(r["fork:3"]).toEqual({ due: "2026-11-25", box: 2 });
    r = reviewAfter(r, "fork:3", false, "2026-11-25");
    expect(r).toEqual({});
  });

  it("restarts on a miss, and ignores clean answers before the card is due", () => {
    let r = reviewAfter({}, "pin:1", true, "2026-11-14");
    r = reviewAfter(r, "pin:1", false, "2026-11-14");
    expect(r["pin:1"].box).toBe(0);
    r = reviewAfter(reviewAfter(r, "pin:1", false, "2026-11-15"), "pin:1", true, "2026-11-18");
    expect(r["pin:1"]).toEqual({ due: "2026-11-19", box: 0 });
    expect(reviewAfter({}, "x:1", false, "2026-11-14")).toEqual({});
  });

  it("lists the most overdue first", () => {
    const r = { "a:1": { due: "2026-11-12", box: 1 }, "b:2": { due: "2026-11-10", box: 0 }, "c:3": { due: "2026-11-30", box: 0 } };
    expect(dueReviews(r, "2026-11-14")).toEqual(["b:2", "a:1"]);
  });
});

describe("flashcards", () => {
  it("seeds a finished lesson's idea for tomorrow, then spaces it 3 and 7 days on", async () => {
    const { completeNode, createInitialState } = await import("./progress");
    const { dueIdeas, reviewAfter, ideaRef } = await import("./review");
    let s = completeNode(createInitialState("g"), "meet", new Date("2026-11-03T10:00:00"));
    s = completeNode(s, "board", new Date("2026-11-03T10:00:00"));
    expect(Object.keys(s.ideas)).toEqual([ideaRef("board")]);
    expect(dueIdeas(s.ideas, "2026-11-03")).toEqual([]);
    expect(dueIdeas(s.ideas, "2026-11-04")).toEqual(["board"]);
    // Finishing it again does not reset the schedule.
    const again = completeNode({ ...s, ideas: reviewAfter(s.ideas, ideaRef("board"), false, "2026-11-04") }, "board", new Date("2026-11-05T10:00:00"));
    expect(again.ideas[ideaRef("board")]).toEqual({ due: "2026-11-07", box: 1 });
    // "Show again" brings it back tomorrow.
    expect(reviewAfter(again.ideas, ideaRef("board"), true, "2026-11-07")[ideaRef("board")]).toEqual({ due: "2026-11-08", box: 0 });
  });
});
