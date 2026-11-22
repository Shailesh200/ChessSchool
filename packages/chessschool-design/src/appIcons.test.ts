import { afterEach, describe, expect, it } from "vitest";
import { ICON_GOALS, iconGoalText, iconUnlock } from "./appIcons";
import { setLanguage } from "./i18n";
import { APP_ICONS } from "./mascot";
import { createInitialState, type LocalState } from "./progress";

afterEach(() => setLanguage("en"));

const base = () => createInitialState("t");
const withProgress = (s: LocalState, p: Partial<LocalState["progress"]>): LocalState => ({ ...s, progress: { ...s.progress, ...p } });

describe("app icon goals", () => {
  it("gives every icon but the default a goal", () => {
    for (const i of APP_ICONS) expect(i.id in ICON_GOALS).toBe(true);
    expect(ICON_GOALS.classroom).toBeNull();
    expect(APP_ICONS.filter((i) => ICON_GOALS[i.id]).length).toBe(APP_ICONS.length - 1);
  });

  it("starts with only the default open and shows progress", () => {
    const s = base();
    expect(iconUnlock(s, "classroom").unlocked).toBe(true);
    for (const i of APP_ICONS.slice(1)) expect(iconUnlock(s, i.id).unlocked).toBe(false);
    const ocean = iconUnlock(withProgress(s, { puzzles: { ...s.progress.puzzles, solved: 4 } }), "ocean");
    expect(ocean).toMatchObject({ have: 4, need: 10, unlocked: false });
    expect(ocean.fraction).toBeCloseTo(0.4);
    expect(iconGoalText(ocean, "Bishop")).toEqual({ goal: "Solve 10 puzzles", progress: "4 of 10" });
  });

  it("opens icons as goals are met", () => {
    const s = base();
    expect(iconUnlock(withProgress(s, { completed: { pawn: "2026-01-01" } }), "sunset").unlocked).toBe(true);
    expect(iconUnlock(withProgress(s, { completed: { meet: "2026-01-01" } }), "sunset").unlocked).toBe(false);
    expect(iconUnlock(withProgress(s, { xp: 450 }), "library").unlocked).toBe(true);
    expect(iconGoalText(iconUnlock(withProgress(s, { xp: 120 }), "library"), "x").progress).toBe("120 of 450 XP");
    expect(iconUnlock(withProgress(s, { bots: { pip: { played: 3, won: 3 } } }), "midnight").unlocked).toBe(false);
    expect(iconUnlock(withProgress(s, { bots: { bishop: { played: 1, won: 1 } } }), "midnight").unlocked).toBe(true);
    expect(iconGoalText(iconUnlock(s, "midnight"), "Professor Bishop").goal).toBe("Beat Professor Bishop or a stronger bot");
  });

  it("keeps a streak icon after the streak ends once its badge was seen", () => {
    const s = withProgress(base(), { streak: { count: 1, lastDay: "2026-01-02" } });
    expect(iconUnlock(s, "night").unlocked).toBe(false);
    expect(iconUnlock({ ...s, badgesSeen: ["streak7"] }, "night").unlocked).toBe(true);
    expect(iconUnlock(withProgress(base(), { streak: { count: 3, lastDay: "2026-01-02" } }), "garden").unlocked).toBe(true);
  });

  it("never locks the icon in use", () => {
    const s = base();
    expect(iconUnlock({ ...s, prefs: { ...s.prefs, appIcon: "pixel" } }, "pixel").unlocked).toBe(true);
  });

  it("speaks Hindi", () => {
    setLanguage("hi");
    expect(iconGoalText(iconUnlock(base(), "ocean"), "x").goal).toBe("10 पहेलियाँ हल करें");
  });
});
