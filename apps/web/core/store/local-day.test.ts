import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, isoDay } from "@chess-school/progression";
import { ROUTINE_STEPS, usePlan } from "./plan.store";
import { useProgression } from "./progression.store";

const RealDateTimeFormat = Intl.DateTimeFormat;

function useDeviceZone(timeZone: string) {
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locales, options) {
    const opts: Intl.DateTimeFormatOptions = { ...options };
    if (!opts.timeZone) opts.timeZone = timeZone;
    return new RealDateTimeFormat(locales, opts);
  });
}

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

describe("RS-LL-01b guest streak at 03:55 IST from the device clock", () => {
  beforeEach(() => {
    useProgression.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("increments once across local midnight and does not double-count", () => {
    useDeviceZone("Asia/Kolkata");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-14T18:00:00.000Z"));
    const evening = isoDay();
    useProgression.getState().registerActivity(evening);
    expect(useProgression.getState().streak).toBe(1);
    expect(useProgression.getState().lastActiveDay).toBe(evening);

    vi.setSystemTime(new Date("2026-07-14T22:25:00.000Z"));
    const morning = isoDay();
    expect(morning).toBe(addDays(evening, 1));
    useProgression.getState().registerActivity(morning);
    expect(useProgression.getState().streak).toBe(2);
    expect(useProgression.getState().lastActiveDay).toBe(morning);

    useProgression.getState().registerActivity(isoDay());
    expect(useProgression.getState().streak).toBe(2);
    expect(useProgression.getState().lastActiveDay).toBe(morning);
  });
});

describe("daily XP key on a same-day register", () => {
  beforeEach(() => {
    useProgression.getState().reset();
    useDeviceZone("UTC");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("moves todayKey without wiping XP already earned", () => {
    useProgression.setState({
      streak: 4,
      lastActiveDay: "2026-07-15",
      todayKey: "2026-07-14",
      todayXp: 25,
      xp: 80,
    });
    useProgression.getState().registerActivity("2026-07-15");
    expect(useProgression.getState().streak).toBe(4);
    expect(useProgression.getState().lastActiveDay).toBe("2026-07-15");
    expect(useProgression.getState().todayKey).toBe("2026-07-15");
    expect(useProgression.getState().todayXp).toBe(25);

    useProgression.getState().awardXp(5);
    expect(useProgression.getState().todayXp).toBe(30);
    expect(useProgression.getState().xp).toBe(85);
  });

  it("keeps earned XP when a +1 UTC day is pulled back to today", () => {
    useProgression.setState({
      streak: 4,
      lastActiveDay: "2026-07-16",
      todayKey: "2026-07-16",
      todayXp: 12,
      xp: 40,
    });
    useProgression.getState().registerActivity("2026-07-15");
    expect(useProgression.getState().streak).toBe(4);
    expect(useProgression.getState().lastActiveDay).toBe("2026-07-15");
    expect(useProgression.getState().todayKey).toBe("2026-07-15");
    expect(useProgression.getState().todayXp).toBe(12);

    useProgression.getState().awardXp(8);
    expect(useProgression.getState().todayXp).toBe(20);
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
    expect(usePlan.getState().homeworkLastDay).toBe("2026-07-15");
  });
});
