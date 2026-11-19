import { describe, expect, it } from "vitest";
import { CELEBRATIONS_MAX, celebrationShare, celebrationText, dismissCelebration, pushCelebration, withCelebrations, type Celebration } from "./celebrate";
import { afterAuthRoute, firstLessonHref, startRoute } from "./firstRun";
import { PATH, completeNode, createInitialState, earnedBadges, hydrateState, type LocalState } from "./progress";
import { applyResult, emptyRatings, queueRating } from "./rating";

const now = new Date("2026-11-16T10:00:00");
const finish = (s: LocalState, id: string) => withCelebrations(s, completeNode(s, id, now), now);
const botWin = (bot = "cody", target = 1100) => ({ input: { kind: "bot" as const, event: `g-${Math.random()}`, bot, result: "win" as const, moves: 30 }, result: { kind: "bot" as const, bot, target, score: 1 as const } });

describe("celebrations", () => {
  it("each kind queues once and never again after it was shown", () => {
    const kinds: Celebration[] = [
      { id: "main:unit:unit1", kind: "unit", unit: "unit1" },
      { id: "main:rank:knight", kind: "rank", rank: "knight" },
      { id: "main:rating:900", kind: "rating", rating: 900, milestone: true },
      { id: "main:league:silver:2026-W47", kind: "league", league: "silver" },
      { id: "main:streak:7", kind: "streak", days: 7 },
    ];
    let s = createInitialState("g");
    for (const c of kinds) s = pushCelebration(pushCelebration(s, c), c);
    expect(s.pendingCelebrations.map((c) => c.kind)).toEqual(["unit", "rank", "rating", "league", "streak"]);
    for (const c of kinds) s = dismissCelebration(s, c.id);
    for (const c of kinds) s = pushCelebration(s, c);
    expect(s.pendingCelebrations).toEqual([]);
    expect(s.celebrated).toHaveLength(5);
  });

  it("finishing the last lesson of a unit celebrates the unit and the rank up", () => {
    let s = createInitialState("g");
    const unit1 = PATH.filter((n) => n.unit === "unit1");
    for (const n of unit1) s = finish(s, n.id);
    const ids = s.pendingCelebrations.map((c) => c.id);
    expect(ids).toContain("main:unit:unit1");
    expect(ids).toContain("main:rank:knight");
    expect(ids.filter((id) => id === "main:unit:unit1")).toHaveLength(1);
  });

  it("a rating crossing a hundred is a milestone; a later best is a rating high", () => {
    let s = createInitialState("g");
    const prev = s;
    s = withCelebrations(prev, queueRating(prev, botWin()), now);
    const first = s.pendingCelebrations[0];
    expect(first).toMatchObject({ kind: "rating", milestone: true });
    expect(first.id).toBe(`main:rating:${Math.floor(s.ratings.player.rating / 100) * 100}`);
    // No "new high" while the rating is still provisional.
    s = { ...s, pendingCelebrations: [], ratings: { ...s.ratings, best: s.ratings.player.rating + 49, player: { ...s.ratings.player, rating: s.ratings.player.rating + 49, games: 12, rd: 60 } } };
    const before = s;
    s = withCelebrations(before, queueRating(before, botWin("cody", before.ratings.player.rating + 300)), now);
    expect(s.pendingCelebrations.map((c) => c.kind)).toEqual(["rating"]);
  });

  it("a streak milestone fires exactly once, on the day it is reached", () => {
    const at = (streak: number, lastDay: string): LocalState => {
      const s = createInitialState("g");
      return { ...s, progress: { ...s.progress, streak: { ...s.progress.streak, count: streak, lastDay } } };
    };
    let s = withCelebrations(at(6, "2026-11-15"), at(7, "2026-11-16"), now);
    expect(s.pendingCelebrations).toEqual([{ id: "main:streak:7", kind: "streak", days: 7 }]);
    s = dismissCelebration(s, "main:streak:7");
    // The same day again, and a later restart at 7, never repeat it.
    expect(withCelebrations({ ...s, progress: at(6, "2026-11-15").progress }, s, now).pendingCelebrations).toEqual([]);
    expect(withCelebrations(at(7, "2026-11-16"), at(8, "2026-11-16"), now).pendingCelebrations).toEqual([]);
  });

  it("names every kind in the app language and shares no name", () => {
    const kinds: Celebration[] = [
      { id: "a", kind: "unit", unit: "unit1" },
      { id: "b", kind: "rank", rank: "knight" },
      { id: "c", kind: "rating", rating: 900, milestone: true },
      { id: "d", kind: "rating", rating: 934, milestone: false },
      { id: "e", kind: "league", league: "knight" },
      { id: "f", kind: "streak", days: 30 },
    ];
    const titles = kinds.map((c) => celebrationText(c).title);
    expect(new Set(titles).size).toBe(kinds.length);
    expect(titles[0]).toContain("Unit 1");
    expect(celebrationShare(kinds[5])).toBe("30-day streak! I'm learning chess on ChessSchool. https://chess-school.in");
  });

  it("hydrate drops broken and excess celebrations", () => {
    const raw = { ...createInitialState("g"), pendingCelebrations: [{ id: "x", kind: "nope" }, ...Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, kind: "streak", days: 7 }))], celebrated: ["a", 3] };
    const s = hydrateState(JSON.parse(JSON.stringify(raw)), () => "g2");
    expect(s.pendingCelebrations).toHaveLength(CELEBRATIONS_MAX);
    expect(s.celebrated).toEqual(["a"]);
  });
});

describe("rating peaks and badges", () => {
  it("tracks the best rating, the strongest bot beaten and the biggest upset", () => {
    const r = applyResult(emptyRatings(), botWin("rex", 1200).result);
    expect(r.best).toBe(r.player.rating);
    expect(r.bestWin).toBe(1200);
    expect(r.upset).toBe(800);
    expect(earnedBadges(createInitialState("g").progress, r)).toEqual(expect.arrayContaining(["bestWin", "highWin"]));
    expect(earnedBadges(createInitialState("g").progress)).not.toContain("bestWin");
  });
});

describe("first run", () => {
  const fresh = { ...createInitialState("g"), termsAt: "2026-11-17T10:00:00.000Z" };
  it("every device agrees to the terms first, even a signed-in one", () => {
    expect(startRoute(createInitialState("g"))).toBe("/start");
    expect(startRoute({ ...createInitialState("g"), seenWelcome: true })).toBe("/start");
  });

  it("a new install opens the first lesson, then welcome, then Today", () => {
    expect(startRoute(fresh)).toBe("/lesson/board?first=1");
    expect(startRoute(fresh, { lessons: [{ id: "meet" }, { id: "intro" }] })).toBe(firstLessonHref({ lessons: [{ id: "meet" }, { id: "intro" }] }));
    const lessonDone = completeNode(fresh, "board", now);
    expect(startRoute(lessonDone)).toBe("/welcome");
    expect(startRoute({ ...lessonDone, seenWelcome: true })).toBe("/today");
  });

  it("signed-in accounts never open welcome or the first lesson", () => {
    expect(startRoute({ ...fresh, account: { id: "u", email: "a@b.c", name: "A", provider: "password" } })).toBe("/today");
  });

  it("after sign-in: only a brand-new account on a first run sees welcome", () => {
    expect(afterAuthRoute("signup", true, 0)).toBe("/welcome");
    expect(afterAuthRoute("signup", false, 0)).toBe("/today");
    expect(afterAuthRoute("login", true, 0)).toBe("/today");
    expect(afterAuthRoute("google", true, 0)).toBe("/welcome");
    expect(afterAuthRoute("google", true, 40)).toBe("/today");
    expect(afterAuthRoute("apple", true, 40)).toBe("/today");
    expect(afterAuthRoute("apple", false, 0)).toBe("/today");
  });
});
