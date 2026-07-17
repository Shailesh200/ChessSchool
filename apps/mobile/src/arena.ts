import { botProfile } from "./bots";

export interface ArenaBot {
  id: string;
  name: string;
  elo: number;
}

export interface ArenaGameResult {
  opponentId: string;
  playerScore: number;
  gameId: string;
  at: number;
}

export interface ArenaRun {
  id: string;
  bandElo: number;
  opponents: ArenaBot[];
  results: ArenaGameResult[];
  startedAt: number;
  completedAt?: number;
  xpAwarded?: number;
}

export interface ArenaRunRecord {
  id: string;
  bandElo: number;
  playerPoints: number;
  placement: number;
  xpEarned: number;
  completedAt: number;
}

export interface ArenaStandingsRow {
  id: string;
  name: string;
  elo?: number;
  points: number;
  played: number;
  isPlayer: boolean;
}

const ROSTER_OFFSETS = [-50, -25, 25, 50] as const;

export function arenaRoster(bandElo: number): ArenaBot[] {
  return ROSTER_OFFSETS.map((off, i) => {
    const elo = Math.max(300, Math.min(2500, bandElo + off));
    const b = botProfile(elo);
    return { id: `arena-${i}`, name: b.name, elo };
  });
}

export function createArenaRun(bandElo: number): ArenaRun {
  return {
    id: `arena-${Date.now()}`,
    bandElo,
    opponents: arenaRoster(bandElo),
    results: [],
    startedAt: Date.now(),
  };
}

export function nextArenaOpponent(run: ArenaRun): ArenaBot | null {
  const done = new Set(run.results.map((r) => r.opponentId));
  return run.opponents.find((o) => !done.has(o.id)) ?? null;
}

export function arenaGamesPlayed(run: ArenaRun): number {
  return run.results.length;
}

export function isArenaComplete(run: ArenaRun): boolean {
  return run.results.length >= run.opponents.length;
}

export function arenaStandings(run: ArenaRun): ArenaStandingsRow[] {
  const rows: ArenaStandingsRow[] = [
    { id: "you", name: "You", points: 0, played: 0, isPlayer: true },
    ...run.opponents.map((o) => ({
      id: o.id,
      name: o.name,
      elo: o.elo,
      points: 0,
      played: 0,
      isPlayer: false,
    })),
  ];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of run.results) {
    const you = byId.get("you")!;
    you.points += r.playerScore;
    you.played += 1;
    const bot = byId.get(r.opponentId);
    if (bot) {
      bot.points += 1 - r.playerScore;
      bot.played += 1;
    }
  }
  return [...rows].sort(
    (a, b) => b.points - a.points || b.played - a.played || a.name.localeCompare(b.name),
  );
}

export function playerArenaPlacement(run: ArenaRun): number {
  const standings = arenaStandings(run);
  const idx = standings.findIndex((r) => r.isPlayer);
  return idx < 0 ? standings.length : idx + 1;
}

export function arenaXpBonus(run: ArenaRun): number {
  const pts = run.results.reduce((sum, r) => sum + r.playerScore, 0);
  const base = 30;
  const perPoint = 12;
  const sweep = pts >= run.opponents.length ? 20 : 0;
  return base + Math.round(pts * perPoint) + sweep;
}

export const ARENA_ELO_BANDS = [600, 900, 1200, 1600] as const;
