import { describe, expect, it } from "vitest";
import { completeNode, createInitialState, hydrateState, recordGame, recordPractice, recordPuzzle, START_FEN, type LocalState } from "./progress";
import { lockedUntil, pickQuests, QUESTS_PER_DAY, todayQuests, trackQuests, type QuestId } from "./quests";

const DAY = "2026-11-14";
const at = (day: string) => new Date(`${day}T12:00:00`);
const member = (): LocalState => ({ ...createInitialState("g"), account: { id: "u1", email: "a@b.c", name: "A", provider: "password" } });
const win = { id: "g1", endedAt: 0, setup: { opponent: { kind: "bot" as const, bot: "cody" }, you: "w" as const, time: "none", startFen: START_FEN, takebacks: true, askPromotion: true }, history: ["e4"], winner: "w" as const, reason: "checkmate" };

/** Does whatever one quest asks for. */
function doQuest(s: LocalState, id: QuestId, day: string): LocalState {
  const now = at(day);
  if (id === "lesson") return completeNode(s, s.progress.completed.meet ? "board" : "meet", now);
  if (id === "practice") return recordPractice(s, now);
  if (id === "game" || id === "win") return recordGame(s, { ...win, id: `g${day}` }, now, 30);
  if (id === "daily") return recordPuzzle(s, { id: "abc12", solved: true, newRating: 600, daily: true }, now);
  if (id === "puzzles") return [1, 2, 3].reduce((st, i) => recordPuzzle(st, { id: `pz${i}0`, solved: true, newRating: 600 }, now), s);
  return recordPractice(s, now, 30); // goal: 30 minutes beats any daily goal
}

describe("pickQuests", () => {
  it("is the same for everyone on a day and differs across days", () => {
    expect(pickQuests(DAY, true)).toEqual(pickQuests(DAY, true));
    expect(pickQuests(DAY, true)).toHaveLength(QUESTS_PER_DAY);
    const days = Array.from({ length: 30 }, (_, i) => pickQuests(`2026-12-${String(i + 1).padStart(2, "0")}`, true).join());
    expect(new Set(days).size).toBeGreaterThan(3);
  });

  it("never gives guests game quests", () => {
    for (let i = 1; i <= 28; i++) {
      const q = pickQuests(`2026-02-${String(i).padStart(2, "0")}`, false);
      expect(q).toHaveLength(QUESTS_PER_DAY);
      expect(q).not.toContain("game");
      expect(q).not.toContain("win");
    }
  });
});

describe("quest progress", () => {
  it("starts at zero and counts each quest from today's activity", () => {
    let s = member();
    expect(todayQuests(s, DAY).every((q) => q.value === 0 && !q.done)).toBe(true);
    for (const id of pickQuests(DAY, true)) {
      s = doQuest(s, id, DAY);
      expect(todayQuests(s, DAY).find((q) => q.id === id)?.done).toBe(true);
    }
  });

  it("adds one quest day when the last quest is done, once per day", () => {
    let s = member();
    for (const id of pickQuests(DAY, true)) s = doQuest(s, id, DAY);
    expect(s.quests).toMatchObject({ days: 1, lastDone: DAY });
    s = recordPractice(s, at(DAY));
    expect(s.quests.days).toBe(1);
  });

  it("resets today's counters on a new day", () => {
    const s = trackQuests(member(), DAY, { puzzles: 2, wins: 1 });
    const next = trackQuests(s, "2026-11-15", { practice: 1 });
    expect(next.quests).toMatchObject({ day: "2026-11-15", puzzles: 0, wins: 0, practice: 1 });
  });

  it("does not count lessons skipped by placement", () => {
    const s = member();
    s.progress = { ...s.progress, completed: { meet: DAY }, placed: ["meet"] };
    expect(todayQuests({ ...s }, DAY).find((q) => q.id === "lesson")?.value ?? 0).toBe(0);
  });

  it("hydrates junk quests as empty", () => {
    const raw = { ...createInitialState("g"), quests: { days: "lots", day: "x" } };
    expect(hydrateState(raw, () => "g").quests).toMatchObject({ days: 0, day: null });
  });
});

describe("quest rewards", () => {
  it("locks rewards until enough quest days, but never the look in use", () => {
    const s = createInitialState("g");
    expect(lockedUntil(s, "theme", "midnight")).toBe(7);
    expect(lockedUntil(s, "theme", "classroom")).toBeNull();
    expect(lockedUntil(s, "theme", "contrast")).toBeNull();
    expect(lockedUntil({ ...s, prefs: { ...s.prefs, theme: "midnight" } }, "theme", "midnight")).toBeNull();
    expect(lockedUntil({ ...s, quests: { ...s.quests, days: 7 } }, "theme", "midnight")).toBeNull();
  });
});
