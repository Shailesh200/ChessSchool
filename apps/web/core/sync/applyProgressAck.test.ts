import { beforeEach, describe, expect, it } from "vitest";
import { applyServerProgressAck } from "@/core/sync/applyProgressAck";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";

describe("applyServerProgressAck", () => {
  beforeEach(() => {
    useProgression.getState().reset();
    usePlan.setState({ homeworkStreak: 0, homeworkLastDay: null });
  });

  it("adopts the merged POST fields", () => {
    useProgression.setState({
      streak: 1,
      lastActiveDay: "2026-10-20",
      rating: 1500,
      ratingUpdatedAt: 10,
      dailyGoalXp: 80,
      goalUpdatedAt: 10,
    });
    usePlan.setState({ homeworkStreak: 4, homeworkLastDay: "2026-10-20" });

    applyServerProgressAck({
      ok: true,
      count: 2,
      streak: 3,
      lastActiveDay: "2026-10-22",
      rating: 1400,
      ratingUpdatedAt: 5_000,
      dailyGoalXp: 30,
      goalUpdatedAt: null,
      homeworkStreak: 2,
      homeworkLastDay: "2026-10-22",
    });

    const progress = useProgression.getState();
    expect(progress.streak).toBe(3);
    expect(progress.lastActiveDay).toBe("2026-10-22");
    expect(progress.rating).toBe(1400);
    expect(progress.ratingUpdatedAt).toBe(5_000);
    expect(progress.dailyGoalXp).toBe(30);
    expect(progress.goalUpdatedAt).toBeUndefined();
    expect(usePlan.getState().homeworkStreak).toBe(2);
    expect(usePlan.getState().homeworkLastDay).toBe("2026-10-22");
  });

  it("leaves local state alone for an old ok/count response", () => {
    useProgression.setState({ streak: 3, rating: 1100 });
    applyServerProgressAck({ ok: true, count: 4 });
    expect(useProgression.getState().streak).toBe(3);
    expect(usePlan.getState().homeworkStreak).toBe(0);
  });
});
