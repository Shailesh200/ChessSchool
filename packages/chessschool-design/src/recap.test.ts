import { describe, expect, it } from "vitest";
import { completeNode, createInitialState, recordGame, recordPuzzle, type GameRecord, type LocalState } from "./progress";
import { closeRecap, markWeek, showRecapCard, weeklyRecap, weekStart } from "./recap";

const at = (day: string, h = 18) => new Date(`${day}T${String(h).padStart(2, "0")}:00:00`);
const bots: Record<string, number> = { pip: 400, rooky: 800 };
const rating = (b: string) => bots[b] ?? 0;
const game = (id: string, bot: string, won: boolean, day: string): GameRecord => ({
  id,
  endedAt: at(day).getTime(),
  setup: { opponent: { kind: "bot", bot }, you: "w", time: "none", startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", takebacks: true, askPromotion: true },
  history: ["e4"],
  winner: won ? "w" : "b",
  reason: "resigned",
});

describe("weekly recap", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2026-11-18")).toBe("2026-11-16");
  });

  it("sums last week from the two week marks and picks the best moment", () => {
    let s: LocalState = markWeek(createInitialState("g"), "2026-11-16");
    s = completeNode(s, "meet", at("2026-11-16"));
    s = completeNode(s, "board", at("2026-11-17"));
    s = recordPuzzle(s, { id: "p1", solved: true, newRating: 620 }, at("2026-11-18"));
    s = recordGame(s, game("a", "pip", true, "2026-11-19"), at("2026-11-19"), 5);
    s = recordGame(s, game("b", "rooky", true, "2026-11-20"), at("2026-11-20"), 5);
    s = recordGame(s, game("c", "rooky", false, "2026-11-21"), at("2026-11-21"), 5);
    s = { ...s, ratings: { ...s.ratings, player: { ...s.ratings.player, rating: 460 } } };
    expect(markWeek(s, "2026-11-20")).toBe(s);
    s = markWeek(s, "2026-11-23");
    s = recordGame(s, game("d", "pip", true, "2026-11-23"), at("2026-11-23"), 5);
    const r = weeklyRecap(s, "2026-11-23", rating)!;
    expect(r).toMatchObject({ week: "2026-11-16", to: "2026-11-22", lessons: 1, puzzles: 1, games: 3, wins: 2, ratingChange: 60 });
    expect(r.xp).toBeGreaterThan(0);
    expect(r.best).toEqual({ kind: "win", bot: "rooky", rating: 800 });
    expect(showRecapCard(s, r, "2026-11-23")).toBe(true);
    expect(showRecapCard(s, r, "2026-11-26")).toBe(false);
    expect(showRecapCard(closeRecap(s, r.week), r, "2026-11-24")).toBe(false);
  });

  it("has nothing to say without last week's mark or with an empty week", () => {
    const fresh = markWeek(createInitialState("g"), "2026-11-23");
    expect(weeklyRecap(fresh, "2026-11-23", rating)).toBeNull();
    const quiet = markWeek(markWeek(createInitialState("g"), "2026-11-16"), "2026-11-23");
    expect(quiet.habit.weeks).toHaveLength(2);
    expect(weeklyRecap(quiet, "2026-11-23", rating)).toBeNull();
    // Skipping a week: the old mark is not last week's.
    const gap = markWeek(markWeek(createInitialState("g"), "2026-11-09"), "2026-11-23");
    expect(weeklyRecap(gap, "2026-11-23", rating)).toBeNull();
  });
});
