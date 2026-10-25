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
      dailyGoalXp: 80,
    });
    usePlan.setState({ homeworkStreak: 4, homeworkLastDay: "2026-10-20" });

    applyServerProgressAck({
      ok: true,
      count: 2,
      streak: 6,
      lastActiveDay: "2026-10-22",
      rating: 1400,
      dailyGoalXp: 30,
      homeworkStreak: 1,
    });

    const progress = useProgression.getState();
    expect(progress.streak).toBe(6);
    expect(progress.lastActiveDay).toBe("2026-10-22");
    expect(progress.rating).toBe(1400);
    expect(progress.dailyGoalXp).toBe(30);
    expect(progress.ratingUpdatedAt).toBeUndefined();
    expect(usePlan.getState().homeworkStreak).toBe(1);
  });

  it("leaves local state alone for an old ok/count response", () => {
    useProgression.setState({ streak: 3, rating: 1100, dailyGoalXp: 50 });
    applyServerProgressAck({ ok: true, count: 4 });
    expect(useProgression.getState().streak).toBe(3);
    expect(useProgression.getState().rating).toBe(1100);
    expect(usePlan.getState().homeworkStreak).toBe(0);
  });
});
