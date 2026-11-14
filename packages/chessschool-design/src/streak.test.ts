import { describe, expect, it } from "vitest";
import { emptyProgress, sanitizeProgress, streakAfterActivity, visibleStreak, type Streak } from "./progress";

const run = (days: string[], from: Streak = { count: 0, lastDay: null }) => days.reduce((s, d) => streakAfterActivity(s, d), from);
const week = Array.from({ length: 7 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);

describe("streak freeze", () => {
  it("earns one freeze per seven days", () => {
    expect(run(week)).toEqual({ count: 7, lastDay: "2026-11-07", freezes: 1 });
  });

  it("uses a freeze for one missed day instead of resetting", () => {
    const s = run([...week, "2026-11-09"]);
    expect(s).toEqual({ count: 8, lastDay: "2026-11-09" });
    expect(visibleStreak(run(week), "2026-11-09")).toBe(7);
  });

  it("resets when more days are missed than there are freezes", () => {
    expect(run([...week, "2026-11-10"])).toEqual({ count: 1, lastDay: "2026-11-10", freezes: 1 });
    expect(visibleStreak(run(week), "2026-11-10")).toBe(0);
  });

  it("caps freezes on the server at one per 7 streak days", () => {
    const p = { ...emptyProgress(), streak: { count: 3, lastDay: "2026-11-03", freezes: 5 } };
    expect(sanitizeProgress(p, null).streak.freezes).toBeUndefined();
    expect(sanitizeProgress({ ...p, streak: { count: 30, lastDay: "2026-11-03", freezes: 9 } }, null).streak.freezes).toBe(2);
  });
});
