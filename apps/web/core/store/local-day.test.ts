import { beforeEach, describe, expect, it } from "vitest";
import { isoDay } from "@chess-school/progression";
import { ROUTINE_STEPS, usePlan } from "./plan.store";
import { useProgression } from "./progression.store";

const IST = "Asia/Kolkata";

describe("RS-LL-01b guest streak at 03:55 IST", () => {
  beforeEach(() => {
    useProgression.getState().reset();
  });

  it("increments once across local midnight and does not double-count", () => {
    const evening = isoDay(new Date("2026-07-14T18:00:00.000Z"), IST); // 23:30 IST
    const morning = isoDay(new Date("2026-07-14T22:25:00.000Z"), IST); // 03:55 IST next day
    expect(evening).toBe("2026-07-14");
    expect(morning).toBe("2026-07-15");

    useProgression.getState().registerActivity(evening);
    expect(useProgression.getState().streak).toBe(1);
    expect(useProgression.getState().lastActiveDay).toBe(evening);

    useProgression.getState().registerActivity(morning);
    expect(useProgression.getState().streak).toBe(2);
    expect(useProgression.getState().lastActiveDay).toBe(morning);

    useProgression.getState().registerActivity(morning);
    expect(useProgression.getState().streak).toBe(2);
    expect(useProgression.getState().lastActiveDay).toBe(morning);
  });
});

describe("homework streak cutover", () => {
  beforeEach(() => {
    usePlan.setState({
      homeworkStreak: 4,
      homeworkLastDay: "2026-07-16",
      routineDay: null,
      routineDone: [],
    });
  });

  it("keeps a UTC homework day that is ahead of the local day", () => {
    for (const step of ROUTINE_STEPS) {
      usePlan.getState().markActivity(step.id, "2026-07-15");
    }
    expect(usePlan.getState().homeworkStreak).toBe(4);
    expect(usePlan.getState().homeworkLastDay).toBe("2026-07-16");
  });
});
