import { describe, expect, it } from "vitest";
import { EXAM_PASS_RATIO, isTutorialLesson, placementStageIndex, scoredStepCount } from "./classExam";
import { allRoutineDoneToday, markHomeworkActivities, markHomeworkActivity } from "./homeworkRoutine";

describe("classExam", () => {
  it("counts move and quiz steps", () => {
    expect(scoredStepCount([{ kind: "info" }, { kind: "move" }, { kind: "quiz" }])).toBe(2);
  });

  it("detects tutorial lessons", () => {
    expect(isTutorialLesson([{ kind: "info" }, { kind: "observe" }])).toBe(true);
    expect(isTutorialLesson([{ kind: "quiz" }])).toBe(false);
    expect(isTutorialLesson([{ kind: "info" }], true)).toBe(false);
  });

  it("matches web placement cutoffs", () => {
    expect(placementStageIndex(0.75, 2)).toBe(2);
    expect(placementStageIndex(0.5, 2)).toBe(1);
    expect(placementStageIndex(0.2, 2)).toBe(0);
  });

  it("uses 67% exam pass bar", () => {
    expect(EXAM_PASS_RATIO).toBe(0.67);
  });
});

describe("homeworkRoutine", () => {
  it("marks a step and bumps streak when all six are done", () => {
    const today = "2026-07-12";
    let snap: Record<string, unknown> = { homeworkStreak: 2, homeworkLastDay: "2026-07-11" };
    snap = markHomeworkActivities(
      snap,
      ["warmup", "lesson", "practice", "match", "review", "reflection"],
      today,
    );
    expect(snap.homeworkStreak).toBe(3);
    expect(snap.homeworkLastDay).toBe(today);
    expect(allRoutineDoneToday(snap, today)).toBe(true);
  });

  it("does not double-mark the same step", () => {
    const today = "2026-07-12";
    const once = markHomeworkActivity({}, "lesson", today);
    const twice = markHomeworkActivity(once, "lesson", today);
    expect(twice).toBe(once);
  });
});
