import { describe, expect, it } from "vitest";
import { answerIdeaCard, answerPractice, completeNode, createInitialState, hydrateState, recordCombo, recordGame, recordMateTry, recordPractice, recordPuzzle, recordReviewedGame, recordSprint, recordVision, shiftDay, START_FEN, type GameRecord, type LocalState, type StoredSetup } from "./progress";
import { hydrateQuests, lockedUntil, monthlyStatus, pickQuests, QUEST_POOL, QUESTS_PER_DAY, questStatus, todayQuests, trackQuests, type QuestId } from "./quests";

const DAY = "2026-11-14";
const at = (day: string) => new Date(`${day}T12:00:00`);
const member = (): LocalState => ({ ...createInitialState("g"), account: { id: "u1", email: "a@b.c", name: "A", provider: "password" } });
const win: GameRecord = { id: "g1", endedAt: 0, setup: { opponent: { kind: "bot" as const, bot: "cody" }, you: "w" as const, time: "none", startFen: START_FEN, takebacks: true, askPromotion: true }, history: ["e4"], winner: "w" as const, reason: "checkmate" };

const game = (id: string, over: Omit<Partial<GameRecord>, "setup"> & { setup?: Partial<StoredSetup> } = {}): GameRecord => ({ ...win, ...over, id, setup: { ...win.setup, ...over.setup } });
const LESSONS = ["meet", "board", "moves", "pawns", "check", "firstGame", "castling"];

/** Does whatever one quest asks for, through the same functions the apps call. */
function doQuest(s: LocalState, id: QuestId, day: string): LocalState {
  const now = at(day);
  const early = new Date(`${day}T08:00:00`);
  const lesson = (st: LocalState, when = now, perfect = false) => completeNode(st, LESSONS.find((l) => !st.progress.completed[l]) ?? "meet", when, undefined, perfect);
  const solve = (st: LocalState, n: number, themes: string[] = []) => Array.from({ length: n }, (_, i) => i).reduce((x, i) => recordPuzzle(x, { id: `pz${day.slice(8)}${i}`, solved: true, newRating: 600, themes }, now), st);
  const theme: Partial<Record<QuestId, [string, number]>> = { forks: ["fork", 3], pins: ["pin", 2], skewers: ["skewer", 2], mateIn1: ["mateIn1", 3], mateIn2: ["mateIn2", 1], discovered: ["discoveredAttack", 2], backRank: ["backRankMate", 2], hanging: ["hangingPiece", 3], endgamePuzzles: ["endgame", 2], promotion: ["promotion", 1] };
  if (theme[id]) return solve(s, theme[id]![1], [theme[id]![0]]);
  switch (id) {
    case "lesson": return lesson(s);
    case "lessons2": return lesson(lesson(s));
    case "lessons3": return lesson(lesson(lesson(s)));
    case "early": return lesson(s, early);
    case "perfect": return lesson(s, now, true);
    case "perfect2": return lesson(lesson(s, now, true), now, true);
    case "combo3": return recordCombo(s, 3, now);
    case "combo5": return recordCombo(s, 5, now);
    case "puzzles": return solve(s, 3);
    case "puzzles5": return solve(s, 5);
    case "puzzles10": return solve(s, 10);
    case "daily": return recordPuzzle(s, { id: "abc12", solved: true, newRating: 600, daily: true }, now);
    case "mate": return recordMateTry(s, day, [true, true], now);
    case "sprint5": return recordSprint(s, 5, now, 3);
    case "sprint10": return recordSprint(s, 10, now, 3);
    case "practice": return recordPractice(s, now);
    case "practice2": return recordPractice(recordPractice(s, now), now);
    case "reviews": return [1, 2, 3, 4, 5].reduce((x, i) => answerPractice(x, `board:${i}`, false, day), s);
    case "cards": return [1, 2, 3].reduce((x) => answerIdeaCard(x, "board", true, now), s);
    case "goal": case "minutes20": return recordPractice(s, now, 30);
    case "game": case "win": return recordGame(s, game(`g${day}`), now, 10);
    case "games3": case "wins2": return [1, 2, 3].reduce((x, i) => recordGame(x, game(`g${day}${i}`), now, 10), s);
    case "winBlack": return recordGame(s, game(`b${day}`, { setup: { you: "b" }, winner: "b" }), now, 10);
    case "cleanWin": return recordGame(s, game(`c${day}`, { history: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"] }), now, 10);
    case "endgame": return recordGame(s, game(`e${day}`, { setup: { startId: "kq-k" } }), now, 10);
    case "review": {
      const x = recordGame(s, game(`r${day}`), now, 10);
      return recordReviewedGame(x, `r${day}`, [], day);
    }
    case "vision": return recordVision(recordVision(s, "colors", 3, now), "colors", 4, now);
    case "vision10": return Array.from({ length: 20 }).reduce<LocalState>((x) => recordVision(x, "colors", 1, now, 30), s);
  }
  throw new Error(`no way to do ${id}`);
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
    for (const id of pickQuests(DAY, true, "g")) {
      s = doQuest(s, id, DAY);
      expect(todayQuests(s, DAY).find((q) => q.id === id)?.done).toBe(true);
    }
  });

  it("adds one quest day when the last quest is done, once per day", () => {
    let s = member();
    for (const id of pickQuests(DAY, true, "g")) s = doQuest(s, id, DAY);
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

describe("fresh quests", () => {
  it("has about 40 templates and never repeats one within 7 days over 60 days, for members, guests and other learners", () => {
    expect(QUEST_POOL.length).toBeGreaterThanOrEqual(40);
    for (const [gym, learner] of [[true, "guest-a"], [false, "guest-a"], [true, "child-7"], [false, ""]] as const) {
      const days = Array.from({ length: 60 }, (_, i) => pickQuests(shiftDay("2026-11-01", i), gym, learner));
      days.forEach((q, i) => {
        expect(new Set(q).size).toBe(QUESTS_PER_DAY);
        const week = days.slice(Math.max(0, i - 6), i).flat();
        for (const id of q) expect(week).not.toContain(id);
      });
      expect(new Set(days.flat()).size).toBeGreaterThan(20);
    }
  });

  it("differs between learners on the same day", () => {
    const day = "2026-11-20";
    const picks = ["a", "b", "c", "d", "e"].map((l) => pickQuests(day, true, l).join());
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it("can finish every template with real app events", () => {
    for (const id of QUEST_POOL) {
      const s = doQuest(member(), id, DAY);
      expect(questStatus(s, id, DAY), id).toMatchObject({ done: true });
    }
  });

  it("does not count yesterday's counters today", () => {
    const s = doQuest(member(), "forks", DAY);
    expect(questStatus(s, "forks", "2026-11-15").value).toBe(0);
  });

  it("keeps old stored quests valid and drops unknown counters", () => {
    const old = hydrateQuests({ day: DAY, puzzles: 2, practice: 1, games: 0, wins: 0, days: 4, lastDone: "2026-11-13" });
    expect(old).toMatchObject({ day: DAY, puzzles: 2, days: 4, counts: {}, badges: [] });
    expect(hydrateQuests({ counts: { t_fork: 2, coins: 9 }, badges: ["2026-10", "x"] })).toMatchObject({ counts: { t_fork: 2 }, badges: ["2026-10"] });
  });

  it("gives the monthly badge once the month's challenge is met", () => {
    // February 2027 is the lessons challenge (12 lessons).
    const day = "2027-02-03";
    expect(monthlyStatus(member(), day)).toMatchObject({ id: "lessons", target: 12, value: 0, done: false });
    let s = member();
    for (let i = 0; i < 12; i++) s = trackQuests(s, day, { lessons: 1 });
    expect(monthlyStatus(s, day)).toMatchObject({ value: 12, done: true });
    expect(s.quests.badges).toEqual(["2027-02"]);
    expect(monthlyStatus(s, "2027-03-01")).toMatchObject({ value: 0, done: false });
  });
});
