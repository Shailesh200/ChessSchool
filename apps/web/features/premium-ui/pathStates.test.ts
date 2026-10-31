import { describe, expect, it } from "vitest";
import { buildPremiumCoursePath, classExamCaption, classPathRow, countExamPuzzles } from "./pathStates";

const tactics = {
  stages: [{ id: "tactics", name: "Tactics" }],
  semesters: [
    {
      id: "forks",
      title: "Forks, pins & skewers",
      stage: "tactics",
      classes: [
        { id: "pins", title: "Pins", examId: "exam-pins" },
        { id: "forks", title: "Knight forks" },
        { id: "skewers", title: "Skewers" },
      ],
    },
  ],
};

describe("premium course path states", () => {
  it("marks done, up-next, and locked classes and fails if those captions collapse", () => {
    const path = buildPremiumCoursePath({
      ...tactics,
      graduatedIds: ["pins"],
      unlocked: (id) => id === "pins" || id === "forks",
    });
    expect(path?.overline).toBe("Stage 1 · Tactics");
    expect(path?.title).toBe("Forks, pins & skewers");
    expect(path?.done).toBe(1);
    expect(path?.total).toBe(3);
    expect(path?.nodes.map((node) => [node.kind, node.caption, node.glyph, node.side])).toEqual([
      ["done", "Class 1 · done", "check", "l"],
      ["current", "Class 2 · up next", "play", "r"],
      ["locked", "Class 3 · locked", "lock", "l"],
      ["exam", "Locked", "flag", "r"],
    ]);
    expect(path?.nodes[1]?.filled).toBe(true);
    expect(path?.nodes[0]?.href).toBe("/class/pins");
    expect(path?.nodes[2]?.href).toBeNull();
  });
});

describe("premium class row states", () => {
  it("uses kit tiles for done, up-next, and locked and fails if the labels revert", () => {
    expect(classPathRow({ tone: "done", index: 0, mastery: 1, activeIndex: 2 })).toEqual({
      tileClass: "tile-done",
      glyph: "check",
      caption: "Done · 100%",
      current: false,
      filled: false,
    });
    expect(classPathRow({ tone: "current", index: 2, mastery: 0.2, activeIndex: 2 })).toMatchObject({
      tileClass: "cs-row__tile--accent",
      glyph: "play",
      caption: "Up next",
      current: true,
    });
    expect(classPathRow({ tone: "locked", index: 3, mastery: 0, activeIndex: 2 }).caption).toBe(
      "Unlocks after lesson 3",
    );
    expect(classPathRow({ tone: "locked", index: 3, mastery: 0, activeIndex: 2 }).tileClass).toBe("tile-lock");
    expect(classExamCaption(6)).toBe("6 puzzles · pass with 5");
    expect(classExamCaption(2)).toBe("2 puzzles · pass with 2");
    expect(classExamCaption(null)).toBe("Pass to graduate");
    expect(countExamPuzzles(JSON.stringify([{ kind: "move" }, { kind: "info" }, { kind: "quiz" }]))).toBe(2);
    expect(countExamPuzzles("not-json")).toBeNull();
  });
});
