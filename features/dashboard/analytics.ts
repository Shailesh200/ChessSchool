import { LESSONS } from "@/features/lessons/curriculum";
import { ALL_CLASSES } from "@/features/school/structure";
import type { LessonRecord } from "@/core/store/progression.store";
import type { SavedGame } from "@/core/db/db";

/** Maps a lesson tag to one of the five skill-tree areas (#36). */
const TAG_AREA: Record<string, string> = {
  openings: "Openings",
  fork: "Tactics",
  tactics: "Tactics",
  checkmate: "Calculation",
  checks: "Calculation",
  endgame: "Endgames",
  opposition: "Endgames",
  basics: "Strategy",
  pawns: "Strategy",
  rooks: "Strategy",
  knights: "Strategy",
};

export const SKILL_AREAS = ["Openings", "Tactics", "Strategy", "Endgames", "Calculation"];

export interface SkillNode {
  area: string;
  mastery: number; // 0..1
  lessons: number;
  done: number;
}

export function skillTree(records: Record<string, LessonRecord>): SkillNode[] {
  return SKILL_AREAS.map((area) => {
    const lessons = LESSONS.filter((l) => TAG_AREA[l.tag] === area);
    const masteries = lessons.map((l) => records[l.id]?.mastery ?? 0);
    const sum = masteries.reduce((a, b) => a + b, 0);
    const done = masteries.filter((m) => m >= 0.9).length;
    return {
      area,
      mastery: lessons.length ? sum / lessons.length : 0,
      lessons: lessons.length,
      done,
    };
  });
}

export interface GameStats {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  resigns: number;
  winRate: number;
}

export function gameStats(games: SavedGame[]): GameStats {
  const bot = games.filter((g) => g.mode === "bot");
  let wins = 0,
    losses = 0,
    draws = 0,
    resigns = 0;
  for (const g of bot) {
    if (g.endReason === "resign") resigns++;
    else if (g.winner === null) draws++;
    else if (g.winner === "w") wins++;
    else losses++;
  }
  const decided = wins + losses + resigns;
  return {
    total: bot.length,
    wins,
    losses,
    draws,
    resigns,
    winRate: decided ? wins / decided : 0,
  };
}

/** Rough practical-strength estimate from target ELO, results and mastery. */
export function skillEstimate(
  targetElo: number,
  stats: GameStats,
  records: Record<string, LessonRecord>,
): number {
  const mastered = Object.values(records).filter((r) => r.mastery >= 0.9).length;
  const winAdj = (stats.winRate - 0.5) * 300;
  const learnAdj = mastered * 12;
  return Math.round(Math.max(400, Math.min(2400, targetElo * 0.6 + 350 + winAdj + learnAdj)));
}

export interface MistakeFinding {
  label: string;
  severity: "high" | "medium" | "low";
  recommendation: string;
}

/** Mistake DNA (#17) — clusters weaknesses + game outcomes into findings. */
export function mistakeDNA(
  weaknesses: Record<string, number>,
  stats: GameStats,
): MistakeFinding[] {
  const findings: MistakeFinding[] = [];
  const entries = Object.entries(weaknesses).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of entries.slice(0, 4)) {
    findings.push({
      label: `${tag} mistakes (${count})`,
      severity: count >= 5 ? "high" : count >= 2 ? "medium" : "low",
      recommendation: `Review the ${tag} class to shore this up.`,
    });
  }
  if (stats.resigns >= 2 && stats.resigns / Math.max(1, stats.total) > 0.4) {
    findings.push({
      label: "Resigns too early",
      severity: "medium",
      recommendation: "Play on in tough spots — practise defensive resources.",
    });
  }
  if (stats.total >= 3 && stats.winRate < 0.3) {
    findings.push({
      label: "Low win rate vs bots",
      severity: "high",
      recommendation: "Drop the bot ELO a notch and focus on not hanging pieces.",
    });
  }
  if (findings.length === 0) {
    findings.push({
      label: "No clear weaknesses yet",
      severity: "low",
      recommendation: "Keep playing and learning — patterns will appear here.",
    });
  }
  return findings;
}

export type Identity = "Attacker" | "Strategist" | "Tactician" | "Positional" | "Balanced";

/** Chess identity (#45) — a light heuristic over results and weaknesses. */
export function chessIdentity(
  stats: GameStats,
  records: Record<string, LessonRecord>,
): Identity {
  const tactics = (records["fork-master"]?.mastery ?? 0) >= 0.7;
  const openings = LESSONS.filter((l) => l.tag === "openings").some(
    (l) => (records[l.id]?.mastery ?? 0) >= 0.7,
  );
  if (tactics && stats.winRate > 0.5) return "Tactician";
  if (stats.wins > stats.draws && stats.winRate > 0.55) return "Attacker";
  if (openings) return "Positional";
  if (stats.draws > stats.wins) return "Strategist";
  return "Balanced";
}

export interface GraduationForecast {
  totalClasses: number;
  graduatedClasses: number;
  remaining: number;
  estDays: number;
}

export function graduationForecast(
  graduatedClasses: string[],
  streak: number,
): GraduationForecast {
  const total = ALL_CLASSES.length;
  const grad = graduatedClasses.length;
  const remaining = Math.max(0, total - grad);
  // assume ~1 class every 3 active days; nudge faster for active streaks
  const pace = streak >= 5 ? 2 : 3;
  return { totalClasses: total, graduatedClasses: grad, remaining, estDays: remaining * pace };
}
