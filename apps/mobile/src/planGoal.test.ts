import { describe, expect, it } from "vitest";
import { mergeProgressSnapshots } from "@chess-school/progression";
import { withDailyGoal } from "./planGoal";

describe("mobile daily goal writer stamp", () => {
  it("stamps a changed goal with the time of the change", () => {
    const next = withDailyGoal({ xp: 5, dailyGoalXp: 80 }, 30, 1_700_000_000_000);
    expect(next).toEqual({ xp: 5, dailyGoalXp: 30, goalUpdatedAt: 1_700_000_000_000 });
  });

  it("leaves the snapshot alone when the goal is unchanged", () => {
    const snap = { dailyGoalXp: 50, goalUpdatedAt: 1_000 };
    expect(withDailyGoal(snap, 50, 9_000)).toBe(snap);
  });

  it("lets a goal go down: the newer lower goal beats the older higher one", () => {
    const serverStamp = Date.now() - 60_000;
    const server = { xp: 0, dailyGoalXp: 80, goalUpdatedAt: serverStamp };
    const local = withDailyGoal({ xp: 0, dailyGoalXp: 80 }, 30);
    const merged = mergeProgressSnapshots(local, server);
    expect(merged.dailyGoalXp).toBe(30);
    expect(merged.goalUpdatedAt).toBeGreaterThan(serverStamp);
  });
});
