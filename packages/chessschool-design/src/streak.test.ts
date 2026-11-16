import { dismissCelebration, withCelebrations } from "./celebrate";
import { afterEach, describe, expect, it } from "vitest";
import { completeNode, createInitialState, emptyProgress, hydrateState, recordPractice, reminderPlan, repairOffer, sanitizeProgress, streakAfterActivity, usualHour, visibleStreak, type LocalState, type Streak } from "./progress";

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

  it("caps freezes at FREEZE_MAX whatever the streak length (invite rewards add freezes to short streaks)", () => {
    const p = { ...emptyProgress(), streak: { count: 3, lastDay: "2026-11-03", freezes: 5 } };
    expect(sanitizeProgress(p, null).streak.freezes).toBe(2);
    expect(sanitizeProgress({ ...p, streak: { ...p.streak, freezes: 0 } }, null).streak.freezes).toBeUndefined();
    expect(sanitizeProgress({ ...p, streak: { count: 30, lastDay: "2026-11-03", freezes: 9 } }, null).streak.freezes).toBe(2);
  });
});

/** Node reads TZ again when it changes, so a test can move the device to another time zone. */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

describe("streaks 2.0", () => {
  const TZ = env.TZ;
  afterEach(() => {
    if (TZ === undefined) delete env.TZ;
    else env.TZ = TZ;
  });
  const withStreak = (count: number, lastDay: string): LocalState => {
    const s = createInitialState("g");
    return { ...s, progress: { ...s.progress, streak: { count, lastDay } } };
  };
  const lessonAt = (s: LocalState, when: Date) => completeNode(s, ["board", "moves", "pawns", "check"].find((l) => !s.progress.completed[l])!, when);

  it("offers a repair after one missed day and brings the streak back after 2 lessons across midnight", () => {
    let s = withStreak(5, "2026-11-10");
    expect(repairOffer(s, "2026-11-11")).toBeNull();
    expect(repairOffer(s, "2026-11-12")).toEqual({ missed: "2026-11-11", prev: 5, lessons: 0 });
    s = lessonAt(s, new Date(2026, 10, 12, 23, 59));
    expect(s.progress.streak.count).toBe(1);
    expect(repairOffer(s, "2026-11-12")).toMatchObject({ prev: 5, lessons: 1 });
    s = lessonAt(s, new Date(2026, 10, 13, 0, 1));
    // 5 days, the repaired day, then the 12th and the 13th.
    expect(s.progress.streak).toMatchObject({ count: 8, lastDay: "2026-11-13" });
    expect(repairOffer(s, "2026-11-13")).toBeNull();
    expect(s.habit.streakRepair).toBeNull();
  });

  it("closes the repair 48 hours after the missed day and never offers it for two missed days or a freeze", () => {
    let s = lessonAt(withStreak(5, "2026-11-10"), new Date(2026, 10, 12, 10));
    expect(repairOffer(s, "2026-11-13")).not.toBeNull();
    expect(repairOffer(s, "2026-11-14")).toBeNull();
    s = lessonAt(s, new Date(2026, 10, 14, 10));
    expect(s.progress.streak.count).toBe(1);
    expect(repairOffer(withStreak(5, "2026-11-10"), "2026-11-13")).toBeNull();
    const frozen = withStreak(7, "2026-11-10");
    frozen.progress.streak.freezes = 1;
    expect(repairOffer(frozen, "2026-11-12")).toBeNull();
  });

  it("counts practice toward breaking but only lessons toward the repair", () => {
    let s = recordPractice(withStreak(4, "2026-11-10"), new Date(2026, 10, 12, 9));
    expect(s.habit.streakRepair).toEqual({ missed: "2026-11-11", prev: 4, lessons: 0 });
    s = recordPractice(s, new Date(2026, 10, 12, 10));
    expect(s.habit.streakRepair?.lessons).toBe(0);
  });

  it("uses the learner's local day: the same instants are one day in Los Angeles and two in Kolkata", () => {
    const first = new Date("2026-11-12T18:00:00Z");
    const second = new Date("2026-11-12T19:00:00Z");
    env.TZ = "Asia/Kolkata"; // 23:30 on the 12th, then 00:30 on the 13th
    let s = lessonAt(lessonAt(withStreak(5, "2026-11-10"), first), second);
    expect(s.progress.streak).toMatchObject({ count: 8, lastDay: "2026-11-13" });
    env.TZ = "America/Los_Angeles"; // 10:00 and 11:00 on the 12th
    s = lessonAt(lessonAt(withStreak(5, "2026-11-10"), first), second);
    expect(s.progress.streak).toMatchObject({ count: 7, lastDay: "2026-11-12" });
  });

  it("queues each milestone once through the celebration queue, even after a break, a new run and a repair", () => {
    const step = (s: LocalState, fn: (s: LocalState) => LocalState, at: Date) => withCelebrations(s, fn(s), at);
    let s = withStreak(6, "2026-11-10");
    let at = new Date(2026, 10, 11, 9);
    s = step(s, (x) => recordPractice(x, at), at);
    expect(s.pendingCelebrations).toEqual([{ id: "main:streak:7", kind: "streak", days: 7 }]);
    s = dismissCelebration(s, "main:streak:7");
    at = new Date(2026, 10, 12, 18);
    s = step(s, (x) => recordPractice(x, at), at);
    expect(s.pendingCelebrations).toEqual([]);
    // Broken, then a new run reaches 7 again: already celebrated.
    s = { ...s, progress: { ...s.progress, streak: { count: 6, lastDay: "2026-12-01" } } };
    at = new Date(2026, 11, 2, 9);
    s = step(s, (x) => recordPractice(x, at), at);
    expect(s.pendingCelebrations).toEqual([]);
    // A repair that lifts the streak past 30 fires 30 once.
    s = { ...s, progress: { ...s.progress, streak: { count: 29, lastDay: "2026-12-10" } } };
    at = new Date(2026, 11, 12, 9);
    s = step(s, (x) => completeNode(x, "board", at), at);
    s = step(s, (x) => completeNode(x, "moves", at), at);
    expect(s.progress.streak.count).toBe(31);
    expect(s.pendingCelebrations).toEqual([{ id: "main:streak:30", kind: "streak", days: 30 }]);
    s = step(s, (x) => recordPractice(x, at), at);
    expect(s.pendingCelebrations).toHaveLength(1);
  });

  it("moves the reminder to the median hour of recent active days, falling back to the setting", () => {
    let s = createInitialState("g");
    const now = new Date(2026, 10, 20, 6, 0);
    expect(reminderPlan(s, now, 1)[0]?.getHours()).toBe(18);
    for (const [d, h] of [[14, 7], [15, 8], [16, 21], [17, 8], [18, 9]]) s = recordPractice(s, new Date(2026, 10, d, h, 30));
    expect(usualHour(s)).toBe(8);
    expect(reminderPlan(s, now, 1)[0]?.getHours()).toBe(8);
    expect(Object.keys(hydrateState(JSON.parse(JSON.stringify(s)), () => "x").habit.playHours)).toHaveLength(5);
  });
});
