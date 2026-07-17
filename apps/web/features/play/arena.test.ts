import { describe, expect, it } from "vitest";
import {
  arenaRoster,
  arenaStandings,
  arenaXpBonus,
  createArenaRun,
  isArenaComplete,
  nextArenaOpponent,
  playerArenaPlacement,
} from "./arena";

describe("arena", () => {
  it("builds four opponents around band", () => {
    const bots = arenaRoster(900);
    expect(bots).toHaveLength(4);
    expect(new Set(bots.map((b) => b.elo)).size).toBe(4);
  });

  it("tracks round-robin progress", () => {
    const run = createArenaRun(1200);
    expect(nextArenaOpponent(run)?.id).toBe("arena-0");
    run.results.push({
      opponentId: "arena-0",
      playerScore: 1,
      gameId: "g1",
      at: 1,
    });
    expect(nextArenaOpponent(run)?.id).toBe("arena-1");
    expect(isArenaComplete(run)).toBe(false);
  });

  it("computes standings and placement", () => {
    const run = createArenaRun(900);
    run.results = [
      { opponentId: "arena-0", playerScore: 1, gameId: "g1", at: 1 },
      { opponentId: "arena-1", playerScore: 1, gameId: "g2", at: 2 },
      { opponentId: "arena-2", playerScore: 0, gameId: "g3", at: 3 },
      { opponentId: "arena-3", playerScore: 0.5, gameId: "g4", at: 4 },
    ];
    const standings = arenaStandings(run);
    expect(standings[0]?.isPlayer).toBe(true);
    expect(playerArenaPlacement(run)).toBe(1);
    expect(arenaXpBonus(run)).toBeGreaterThan(50);
  });
});
