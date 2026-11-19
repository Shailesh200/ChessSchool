import { describe, expect, it } from "vitest";
import { clockAfterMove, clockAt, clockSince, DAY_MS, FIRST_MOVE_MS, formatClock, IDLE_MS, type ClockData } from "./pvpClock";

const live = (over: Partial<ClockData> = {}): ClockData => ({ tc: "10m", whiteMs: 600_000, blackMs: 600_000, turnStartedAt: 0, plies: 0, ...over });

describe("PvP clocks", () => {
  it("runs only the side to move's clock and keeps the other's", () => {
    let d = live();
    d = clockAfterMove(d, 30_000); // white used 30 s
    expect(d).toMatchObject({ whiteMs: 570_000, blackMs: 600_000, turnStartedAt: 30_000, plies: 1 });
    const v = clockAt(d, 40_000); // black thinking for 10 s
    expect(v).toMatchObject({ white: 570_000, black: 590_000, running: "b", flagged: null, aborted: false });
  });

  it("flags the side whose time runs out, after the opening moves", () => {
    const d = live({ whiteMs: 5_000, plies: 4, turnStartedAt: 0 });
    expect(clockAt(d, 4_000).flagged).toBeNull();
    expect(clockAt(d, 6_000)).toMatchObject({ flagged: "w", white: 0 });
  });

  it("calls the game off when a first move takes over a minute", () => {
    expect(clockAt(live(), FIRST_MOVE_MS - 1).aborted).toBe(false);
    expect(clockAt(live(), FIRST_MOVE_MS + 1)).toMatchObject({ aborted: true, flagged: null });
    expect(clockAt(live({ plies: 1 }), FIRST_MOVE_MS + 1).aborted).toBe(true);
    expect(clockAt(live({ plies: 2 }), FIRST_MOVE_MS + 1).aborted).toBe(false);
  });

  it("gives a day per move on the 1-day clock, and closes idle games with no clock", () => {
    const day: ClockData = { tc: "1d", whiteMs: null, blackMs: null, turnStartedAt: 0, plies: 3 };
    expect(clockAt(day, DAY_MS - 1)).toMatchObject({ running: "b", white: null, black: 1, flagged: null });
    expect(clockAt(day, DAY_MS + 1).flagged).toBe("b");
    const none: ClockData = { tc: "none", whiteMs: null, blackMs: null, turnStartedAt: 0, plies: 3 };
    expect(clockAt(none, IDLE_MS - 1)).toMatchObject({ running: null, aborted: false });
    expect(clockAt(none, IDLE_MS + 1).aborted).toBe(true);
  });

  it("counts down only the running side between server updates", () => {
    expect(clockSince({ white: 60_000, black: 30_000, running: "b" }, 5_000)).toEqual({ white: 60_000, black: 25_000 });
    expect(clockSince({ white: 1_000, black: null, running: "w" }, 9_000)).toEqual({ white: 0, black: null });
  });

  it("formats clocks", () => {
    expect(formatClock(598_400, "10m")).toBe("9:59");
    expect(formatClock(3_725_000, "1h")).toBe("1:02:05");
    expect(formatClock(5 * 3600_000, "1d")).toBe("5h");
  });
});
