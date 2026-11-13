import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PATH,
  UNITS,
  START_FEN,
  type GameRecord,
  arrive,
  earnedBadges,
  newBadges,
  placeAt,
  recordPuzzle,
  recordSprint,
  serveDaily,
  completeNode,
  nextNode,
  recordGame,
  recordPractice,
  reminderPlan,
  createInitialState,
  dayKey,
  canUseGym,
  DAILY_SEEN_MAX,
  formatDailyCountdown,
  hydrateState,
  ideasLearned,
  mergeProgress,
  msUntilLocalMidnight,
  msUntilNextLocalMidnight,
  watchLocalMidnight,
  pathStates,
  rankFor,
  sanitizeProgress,
  streakAfterActivity,
  visibleStreak,
  emptyProgress,
} from "./progress";
import { copy } from "./copy";

const at = (iso: string) => new Date(`${iso}T10:00:00`);

afterEach(() => {
  vi.useRealTimers();
});

describe("orientation", () => {
  it("completes once, awards XP once and starts a streak", () => {
    const s0 = createInitialState("g1");
    const s1 = completeNode(s0, "meet", at("2026-11-03"));
    expect(s1.progress.completed.meet).toBe("2026-11-03");
    expect(s1.progress.xp).toBe(10);
    expect(s1.progress.streak).toEqual({ count: 1, lastDay: "2026-11-03" });
    expect(ideasLearned(s1.progress)).toBe(1);

    const s2 = completeNode(s1, "meet", at("2026-11-03"));
    expect(s2.progress.xp).toBe(10);
    expect(s2.progress.minutes.value).toBe(4);
  });

  it("marks node 1 done and leaves every later lesson open", () => {
    const s = completeNode(createInitialState("g"), "meet", at("2026-11-03"));
    const states = pathStates(s.progress);
    expect(states[0]).toEqual({ id: "meet", state: "done" });
    expect(states.slice(1).every((n) => n.state === "current")).toBe(true);
  });

  it("shows node 1 as current before completion", () => {
    expect(pathStates(emptyProgress())[0].state).toBe("current");
  });

  it("ignores locked or unknown nodes", () => {
    const s = createInitialState("g");
    expect(completeNode(s, "nope", at("2026-11-03"))).toBe(s);
    expect(completeNode(s, "castling", at("2026-11-03")).progress.completed.castling).toBe("2026-11-03");
  });
});

describe("streaks", () => {
  it("counts consecutive days and resets after a gap", () => {
    let s = streakAfterActivity({ count: 0, lastDay: null }, "2026-11-01");
    s = streakAfterActivity(s, "2026-11-01");
    expect(s.count).toBe(1);
    s = streakAfterActivity(s, "2026-11-02");
    expect(s.count).toBe(2);
    s = streakAfterActivity(s, "2026-11-05");
    expect(s).toEqual({ count: 1, lastDay: "2026-11-05" });
  });

  it("crosses month and year boundaries", () => {
    expect(streakAfterActivity({ count: 4, lastDay: "2026-12-31" }, "2027-01-01").count).toBe(5);
  });

  it("stays visible through the next day, then shows 0", () => {
    const st = { count: 3, lastDay: "2026-11-03" };
    expect(visibleStreak(st, "2026-11-03")).toBe(3);
    expect(visibleStreak(st, "2026-11-04")).toBe(3);
    expect(visibleStreak(st, "2026-11-05")).toBe(0);
  });

  it("uses the local calendar day", () => {
    expect(dayKey(new Date(2026, 0, 9, 23, 59))).toBe("2026-01-09");
  });
});

describe("ranks", () => {
  it("starts at Pawn level 1 and climbs", () => {
    expect(rankFor(0)).toMatchObject({ rank: "pawn", level: 1, next: "knight", toNext: 100 });
    expect(rankFor(10)).toMatchObject({ rank: "pawn", toNext: 90, fraction: 0.1 });
    expect(rankFor(100).rank).toBe("knight");
    expect(rankFor(5000)).toMatchObject({ rank: "king", next: null, fraction: 1 });
  });
});

describe("guest -> account merge", () => {
  it("keeps every completion, the earliest date, max XP and the newest streak", () => {
    const guest = { ...emptyProgress(), completed: { meet: "2026-11-03" }, xp: 10, streak: { count: 1, lastDay: "2026-11-03" }, minutes: { day: "2026-11-03", value: 2 } };
    const account = { ...emptyProgress(), completed: { meet: "2026-11-01" }, xp: 0, streak: { count: 5, lastDay: "2026-10-20" }, minutes: { day: "2026-10-20", value: 9 } };
    const merged = mergeProgress(guest, account);
    expect(merged.completed.meet).toBe("2026-11-01");
    expect(merged.xp).toBe(10);
    expect(merged.streak).toEqual(guest.streak);
    expect(merged.minutes).toEqual(guest.minutes);
  });

  it("is a no-op when merging with empty progress", () => {
    const p = { ...emptyProgress(), completed: { meet: "2026-11-03" }, xp: 10, streak: { count: 1, lastDay: "2026-11-03" }, minutes: { day: "2026-11-03", value: 2 } };
    expect(mergeProgress(p, emptyProgress())).toEqual(p);
    expect(mergeProgress(emptyProgress(), p)).toEqual(p);
  });
});

describe("sanitizeProgress", () => {
  it("drops locked/unknown nodes and caps XP to what was earned", () => {
    const p = sanitizeProgress({
      ...emptyProgress(),
      completed: { meet: "2026-11-03", board: "2026-11-03", hack: "x", moves: "bad-date", pawns: "2026-11-03" },
      xp: 99999,
      streak: { count: -4, lastDay: "garbage" },
      minutes: { day: "2026-11-03", value: 99999 },
      games: { played: 3, won: 9 },
      drills: -2,
    });
    expect(p.completed).toEqual({ meet: "2026-11-03", board: "2026-11-03" });
    expect(p.xp).toBe(30);
    expect(p.games).toEqual({ played: 3, won: 3 });
    expect(p.drills).toBe(0);
    expect(p.streak).toEqual({ count: 0, lastDay: null });
    expect(p.minutes.value).toBe(1440);
  });
});

describe("hydrateState", () => {
  it("recovers from junk and old versions", () => {
    expect(hydrateState("nope", () => "new").guestId).toBe("new");
    expect(hydrateState({ version: 1 }, () => "new").guestId).toBe("new");
    const kept = hydrateState({ ...createInitialState("old"), seenWelcome: true }, () => "new");
    expect(kept.guestId).toBe("old");
    expect(kept.seenWelcome).toBe(true);
  });
});

const game = (result: "win" | "loss" | "draw", bot = "cody"): GameRecord => ({
  id: `g${Math.random()}`,
  endedAt: 0,
  setup: { opponent: { kind: "bot", bot }, you: "w", time: "none", startFen: START_FEN, takebacks: true, askPromotion: true },
  history: ["e4"],
  winner: result === "win" ? "w" : result === "loss" ? "b" : null,
  reason: "checkmate",
});
const finish = (ids: string[], day = "2026-11-03") => ids.reduce((st, id) => completeNode(st, id, at(day)), createInitialState("g"));

describe("chess lessons on the path", () => {
  it("open one after another and award XP once each", () => {
    const s = finish(["meet", "board", "moves"]);
    expect(Object.keys(s.progress.completed)).toEqual(["meet", "board", "moves"]);
    expect(s.progress.xp).toBe(50);
    expect(nextNode(s.progress)?.id).toBe("pawns");
    expect(completeNode(s, "firstGame", at("2026-11-03")).progress.completed.firstGame).toBe("2026-11-03");
  });

  it("can be replayed without more XP", () => {
    const s = finish(["meet", "board"]);
    const again = completeNode(s, "board", at("2026-11-03"));
    expect(again.progress.xp).toBe(s.progress.xp);
    expect(again.progress.minutes.value).toBe(s.progress.minutes.value + 5);
  });

  it("reports the end of the path", () => {
    expect(nextNode(finish(["meet", "board", "moves", "pawns", "check", "firstGame"]).progress)?.id).toBe("castling");
    expect(nextNode(finish(PATH.map((n) => n.id)).progress)).toBeNull();
  });

  it("grows the streak on a lesson the next day", () => {
    const day1 = finish(["meet"], "2026-11-03");
    const day2 = completeNode(day1, "board", at("2026-11-04"));
    expect(day2.progress.streak).toEqual({ count: 2, lastDay: "2026-11-04" });
  });
});

describe("practice and games", () => {
  it("count toward the streak and goal but never add XP", () => {
    let s = finish(["meet", "board"]);
    const xp = s.progress.xp;
    s = recordPractice(s, at("2026-11-04"));
    expect(s.progress.drills).toBe(1);
    expect(s.progress.streak.count).toBe(2);
    s = recordGame(s, game("win"), at("2026-11-04"), 50);
    expect(s.progress.games).toEqual({ played: 1, won: 1 });
    expect(s.progress.minutes).toEqual({ day: "2026-11-04", value: 33 });
    expect(s.progress.xp).toBe(xp);
    s = recordGame({ ...s, activeGame: { setup: game("loss").setup, history: ["e4"], startedAt: 0, clock: null } }, game("loss"), at("2026-11-04"), 4);
    expect(s.progress.games).toEqual({ played: 2, won: 1 });
    expect(s.activeGame).toBeNull();
  });
});

describe("you came back", () => {
  it("greets a kept streak the next day, a lapsed one after a gap, and only once a day", () => {
    const s = finish(["meet"], "2026-11-03");
    const opened = arrive(s, at("2026-11-03"));
    expect(opened.arrival).toBeNull();
    const next = arrive(opened, at("2026-11-04"));
    expect(next.arrival).toBe("kept");
    expect(arrive({ ...next, arrival: null }, at("2026-11-04")).arrival).toBeNull();
    expect(arrive(opened, at("2026-11-09")).arrival).toBe("fresh");
  });

  it("stays quiet for someone who never practised", () => {
    expect(arrive(createInitialState("g"), at("2026-11-04")).arrival).toBeNull();
  });

  it("clears once you do something today", () => {
    const s = arrive(finish(["meet"], "2026-11-03"), at("2026-11-04"));
    expect(completeNode(s, "board", at("2026-11-04")).arrival).toBeNull();
  });
});

describe("daily reminder", () => {
  it("plans a week at the chosen hour, skipping today once the goal is met", () => {
    const base = { ...createInitialState("g"), prefs: { ...createInitialState("g").prefs, reminderHour: 18 } };
    const morning = new Date(2026, 10, 4, 9, 0);
    const plan = reminderPlan(base, morning);
    expect(plan).toHaveLength(7);
    expect(plan[0]).toEqual(new Date(2026, 10, 4, 18, 0));
    const met = recordGame(base, game("draw"), morning, 15);
    expect(reminderPlan(met, morning)[0]).toEqual(new Date(2026, 10, 5, 18, 0));
    expect(reminderPlan(base, new Date(2026, 10, 4, 19, 0))[0]).toEqual(new Date(2026, 10, 5, 18, 0));
  });
});

describe("guest -> account merge hardening", () => {
  it("keeps chess lessons, games and drills from both sides and is idempotent", () => {
    const guest = recordGame(finish(["meet", "board", "moves"]), game("win"), at("2026-11-03"), 5).progress;
    const account = { ...emptyProgress(), completed: { meet: "2026-10-01" }, xp: 10, games: { played: 4, won: 0 }, drills: 2 };
    const merged = sanitizeProgress(mergeProgress(guest, account));
    expect(Object.keys(merged.completed).sort()).toEqual(["board", "meet", "moves"]);
    expect(merged.completed.meet).toBe("2026-10-01");
    expect(merged.xp).toBe(50);
    expect(merged.games).toEqual({ played: 4, won: 1 });
    expect(merged.drills).toBe(2);
    expect(sanitizeProgress(mergeProgress(merged, guest))).toEqual(merged);
  });

  it("accepts progress saved before games and drills existed", () => {
    const old = { completed: { meet: "2026-11-03" }, xp: 10, streak: { count: 1, lastDay: "2026-11-03" }, minutes: { day: "2026-11-03", value: 2 } };
    const merged = mergeProgress(old as never, emptyProgress());
    expect(merged.games).toEqual({ played: 0, won: 0 });
    const hydrated = hydrateState({ ...createInitialState("old"), progress: old }, () => "new");
    expect(hydrated.progress.games).toEqual({ played: 0, won: 0 });
    expect(hydrated.progress.completed.meet).toBe("2026-11-03");
  });

  it("loads daily progress saved before the seen list and caps it at a year", () => {
    const old = {
      completed: { meet: "2026-11-03" },
      xp: 10,
      streak: { count: 1, lastDay: "2026-11-03" },
      minutes: { day: "2026-11-03", value: 2 },
      puzzles: { rating: 640, attempts: 2, solved: 1, recent: ["abc12"], sprintBest: 0, daily: { lastDay: "2026-11-03", count: 1 } },
    };
    const hydrated = hydrateState({ ...createInitialState("old"), progress: old }, () => "new");
    expect(hydrated.progress.puzzles.daily.seen).toEqual([]);
    expect(hydrated.progress.puzzles.daily.lastDay).toBe("2026-11-03");
    expect(hydrated.progress.puzzles.daily.count).toBe(1);
    const sanitized = sanitizeProgress(old as never);
    expect(sanitized.puzzles.daily.seen).toEqual([]);
    const merged = mergeProgress(old as never, emptyProgress());
    expect(merged.puzzles.daily.seen).toEqual([]);
    expect(merged.puzzles.daily.lastDay).toBe("2026-11-03");

    const ids = Array.from({ length: DAILY_SEEN_MAX + 40 }, (_, i) => `a${String(i).padStart(4, "0")}`);
    const capped = sanitizeProgress({
      ...emptyProgress(),
      puzzles: { ...emptyProgress().puzzles, daily: { lastDay: "2026-11-04", count: 1, seen: [...ids, "no", 12 as never] } },
    });
    expect(capped.puzzles.daily.seen).toEqual(ids.slice(0, DAILY_SEEN_MAX));

    let served = createInitialState("g");
    for (const id of ids) served = serveDaily(served, "2026-11-04", id);
    expect(served.progress.puzzles.daily.seen).toHaveLength(DAILY_SEEN_MAX);
    expect(served.progress.puzzles.daily.seen?.[0]).toBe(ids.at(-1));

    const snap = { id: "abc12", fen: "7k/6pp/8/8/8/n7/Q7/6RK b - - 0 1", moves: ["a3b1", "a2a8"], rating: 900, themes: ["mateIn1"] };
    const locked = serveDaily(createInitialState("g"), "2026-11-13", snap.id, snap);
    expect(locked.progress.puzzles.daily.servedId).toBe("abc12");
    expect(locked.progress.puzzles.daily.served).toEqual(snap);
    const kept = sanitizeProgress(locked.progress).puzzles.daily.served;
    expect(kept).toEqual(snap);
  });
});

describe("Phase 3 progress", () => {
  it("keeps per-bot records and a review log, and counts pass & play without wins", () => {
    let s = finish(["meet"]);
    s = recordGame(s, game("win", "bishop"), at("2026-11-04"), 10);
    s = recordGame(s, game("loss", "bishop"), at("2026-11-04"), 10);
    expect(s.progress.bots.bishop).toEqual({ played: 2, won: 1 });
    expect(s.gameLog).toHaveLength(2);
    const friend: GameRecord = { ...game("win"), setup: { ...game("win").setup, opponent: { kind: "friend" } } };
    s = recordGame(s, friend, at("2026-11-04"), 5);
    expect(s.progress.games).toEqual({ played: 3, won: 1 });
    expect(earnedBadges(s.progress)).toContain("beatBishop");
  });

  it("rates puzzles, tracks the daily puzzle streak and best sprint", () => {
    let s = createInitialState("g");
    s = recordPuzzle(s, { id: "abc12", solved: true, newRating: 620, daily: true }, at("2026-11-03"));
    s = recordPuzzle(s, { id: "abc13", solved: true, newRating: 640, daily: true }, at("2026-11-04"));
    s = recordPuzzle(s, { id: "abc14", solved: false, newRating: 625 }, at("2026-11-04"));
    expect(s.progress.puzzles).toMatchObject({ rating: 625, attempts: 3, solved: 2, recent: ["abc14", "abc13", "abc12"], daily: { lastDay: "2026-11-04", count: 2, seen: ["abc13", "abc12"] } });
    const missed = recordPuzzle(createInitialState("g"), { id: "abc15", solved: false, newRating: 580, daily: true }, at("2026-11-05"));
    expect(missed.progress.puzzles.daily).toEqual({ lastDay: null, count: 0, seen: [], servedDay: null, servedId: null });
    expect(s.progress.streak.count).toBe(2);
    s = recordSprint(s, 12, at("2026-11-04"), 3);
    s = recordSprint(s, 9, at("2026-11-04"), 3);
    expect(s.progress.puzzles.sprintBest).toBe(12);
  });

  it("places experienced players ahead without XP", () => {
    const s = placeAt(createInitialState("g"), "player", at("2026-11-04"));
    expect(nextNode(s.progress)?.id).toBe("castling");
    expect(s.progress.xp).toBe(0);
    expect(s.progress.puzzles.rating).toBe(1000);
    expect(earnedBadges(s.progress)).not.toContain("firstLesson");
    expect(sanitizeProgress(s.progress).completed.firstGame).toBe("2026-11-04");
  });

  it("celebrates each badge once", () => {
    const s = completeNode(completeNode(createInitialState("g"), "meet", at("2026-11-04")), "board", at("2026-11-04"));
    expect(newBadges(s)).toEqual(["firstLesson"]);
    expect(newBadges({ ...s, badgesSeen: ["firstLesson"] })).toEqual([]);
  });

  it("migrates a Phase 2 saved game and keeps prefs valid", () => {
    const h = hydrateState({ ...createInitialState("old"), activeGame: { history: ["e4"], you: "b", level: "steady", startedAt: 5 }, prefs: { theme: "nope", pieceSet: "pixel" } }, () => "n");
    expect(h.activeGame?.setup.opponent).toEqual({ kind: "bot", bot: "rooky" });
    expect(h.prefs.theme).toBe("classroom");
    expect(h.prefs.pieceSet).toBe("pixel");
    expect(h.prefs.promotion).toBe("ask");
    for (const removed of ["spatial", "arcade", "bold", "heritage", "cartoon", "fantasy", "chessnut", "dubrovny", "kiwen-suwi"]) {
      expect(hydrateState({ ...createInitialState("old"), prefs: { pieceSet: removed } }, () => "n").prefs.pieceSet).toBe("toy");
    }
  });

  it("moves the day key at local midnight with one re-armed timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 23, 59, 59));
    const days: string[] = [];
    const watch = watchLocalMidnight((day) => days.push(day));
    expect(msUntilNextLocalMidnight(new Date())).toBe(1000);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(999);
    expect(days).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(days).toEqual(["2026-11-14"]);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(days).toEqual(["2026-11-14", "2026-11-15"]);
    watch.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(days).toEqual(["2026-11-14", "2026-11-15"]);
  });

  it("re-keys immediately when a throttled midnight timer is synced", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 22, 0, 0));
    const days: string[] = [];
    const watch = watchLocalMidnight((day) => days.push(day));
    vi.setSystemTime(new Date(2026, 10, 14, 8, 0, 0));
    watch.sync();
    expect(days).toEqual(["2026-11-14"]);
    expect(vi.getTimerCount()).toBe(1);
    watch.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("counts down to the next local midnight and keeps the gym for accounts", () => {
    const now = new Date(2026, 10, 13, 23, 15, 10);
    expect(msUntilLocalMidnight(now)).toBe((44 * 60 + 50) * 1000);
    expect(formatDailyCountdown(msUntilLocalMidnight(now))).toBe("0:44:50");
    expect(msUntilLocalMidnight(new Date(2026, 10, 14, 0, 0, 0))).toBe(24 * 60 * 60 * 1000);
    expect(canUseGym(null)).toBe(false);
    expect(canUseGym(undefined)).toBe(false);
    expect(canUseGym({ id: "" })).toBe(false);
    expect(canUseGym({ id: "u1" })).toBe(true);
  });

  it("merges puzzles and bot records from both devices", () => {
    const a = { ...emptyProgress(), puzzles: { ...emptyProgress().puzzles, rating: 900, attempts: 30, solved: 20, sprintBest: 5 }, bots: { cody: { played: 3, won: 2 } } };
    const b = { ...emptyProgress(), puzzles: { ...emptyProgress().puzzles, rating: 700, attempts: 5, solved: 4, sprintBest: 9 }, bots: { pip: { played: 1, won: 1 } } };
    const m = mergeProgress(a, b);
    expect(m.puzzles).toMatchObject({ rating: 900, attempts: 30, solved: 20, sprintBest: 9 });
    const withSeen = mergeProgress(
      { ...emptyProgress(), puzzles: { ...emptyProgress().puzzles, daily: { lastDay: "2026-11-04", count: 2, seen: ["aaa11"], servedDay: "2026-11-04", servedId: "aaa11" } } },
      { ...emptyProgress(), puzzles: { ...emptyProgress().puzzles, daily: { lastDay: "2026-11-03", count: 1, seen: ["bbb22", "aaa11"], servedDay: null, servedId: null } } },
    );
    expect(withSeen.puzzles.daily).toEqual({ lastDay: "2026-11-04", count: 2, seen: ["aaa11", "bbb22"], servedDay: "2026-11-04", servedId: "aaa11" });
    expect(m.bots).toEqual({ cody: { played: 3, won: 2 }, pip: { played: 1, won: 1 } });
  });
});

describe("extended course path", () => {
  it("keeps the original eleven units first, then seven new ones", () => {
    expect(UNITS.slice(0, 11)).toEqual(["unit1", "unit2", "unit3", "unit4", "unit5", "unit6", "unit7", "unit8", "unit9", "unit10", "unit11"]);
    expect(UNITS).toHaveLength(18);
    expect(PATH[0].id).toBe("meet");
    expect(PATH.find((n) => n.id === "queenEnding")?.unit).toBe("unit11");
    expect(PATH.filter((n) => n.unit === "unit11").map((n) => n.id)).toEqual(["queenEnding"]);
    expect(PATH.at(-1)?.id).toBe("calculation");
    expect(new Set(PATH.map((n) => n.id)).size).toBe(PATH.length);
    expect(PATH.every((n) => UNITS.includes(n.unit) && n.available && copy.path[n.id])).toBe(true);
  });

  it("lists coming-soon teasers that are not playable path lessons", () => {
    expect(copy.comingSoon.length).toBeGreaterThan(0);
    const pathIds = new Set(PATH.map((n) => n.id));
    for (const item of copy.comingSoon) {
      expect(pathIds.has(item.id)).toBe(false);
      expect(item.title.length).toBeGreaterThan(0);
    }
  });
});
