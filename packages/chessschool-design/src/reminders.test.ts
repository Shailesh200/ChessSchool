import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "./i18n";
import { createInitialState, type LocalState } from "./progress";
import { reminderMood, reminderText } from "./reminders";

const at = (day: string) => new Date(`${day}T18:00:00`);
const withStreak = (count: number, lastDay: string): LocalState => {
  const s = createInitialState("g");
  return { ...s, progress: { ...s.progress, streak: { count, lastDay, freezes: 0 } } };
};

describe("reminders", () => {
  afterEach(() => setLanguage("en"));

  it("picks the reminder by what happened since the last lesson", () => {
    expect(reminderMood(createInitialState("g"), at("2026-11-26"))).toEqual({ kind: "daily" });
    expect(reminderMood(withStreak(4, "2026-11-26"), at("2026-11-26"))).toEqual({ kind: "goal" });
    expect(reminderMood(withStreak(4, "2026-11-25"), at("2026-11-26"))).toEqual({ kind: "streak", streak: 4 });
    expect(reminderMood(withStreak(4, "2026-11-25"), at("2026-11-28"))).toEqual({ kind: "away", days: 2 });
    expect(reminderMood(withStreak(4, "2026-11-25"), at("2026-12-02"), true)).toEqual({ kind: "last" });
  });

  it("rotates lines and fills in the numbers, in both languages", () => {
    const a = reminderText({ kind: "streak", streak: 6 }, "", 0);
    const b = reminderText({ kind: "streak", streak: 6 }, "", 1);
    expect(a.title).toContain("6");
    expect(a.title).not.toBe(b.title);
    expect(reminderText({ kind: "daily" }, " Asha ", 1).body).toMatch(/^Asha,/);
    setLanguage("hi");
    expect(reminderText({ kind: "away", days: 3 }, "", 0).title).toContain("3 दिन");
  });
});
