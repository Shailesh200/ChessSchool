import { copy } from "./copy";
import type { AppIconId } from "./mascot";
import { RANKS, type LocalState } from "./progress";

/** What unlocks an app icon. `need` is a count (lessons, streak days, puzzles, wins) or XP for a rank. */
export type IconGoal = { kind: "lesson"; need: 1 } | { kind: "streak"; need: 3 | 7 } | { kind: "puzzles"; need: number } | { kind: "rank"; need: number; rank: (typeof RANKS)[number]["id"] } | { kind: "bot"; need: 1 };

const rankXp = (id: (typeof RANKS)[number]["id"]) => RANKS.find((r) => r.id === id)!.xp;

/** One goal per icon; the default icon is always open. */
export const ICON_GOALS: Record<AppIconId, IconGoal | null> = {
  classroom: null,
  sunset: { kind: "lesson", need: 1 },
  garden: { kind: "streak", need: 3 },
  ocean: { kind: "puzzles", need: 10 },
  library: { kind: "rank", need: rankXp("rook"), rank: "rook" },
  night: { kind: "streak", need: 7 },
  pixel: { kind: "puzzles", need: 50 },
  midnight: { kind: "bot", need: 1 },
};

/** Bots at Professor Bishop's level (3) or stronger; a win against any of them opens the Royal icon. */
export const STRONG_BOTS = ["bishop", "ivy", "atlas", "raja", "cody"] as const;

export type IconUnlock = { goal: IconGoal | null; have: number; need: number; unlocked: boolean; fraction: number };

function have(state: LocalState, goal: IconGoal): number {
  const p = state.progress;
  switch (goal.kind) {
    case "lesson":
      return Object.keys(p.completed).filter((id) => id !== "meet" && !p.placed.includes(id)).length;
    case "streak":
      // A streak badge already celebrated keeps the icon open after the streak ends.
      return state.badgesSeen.includes(`streak${goal.need}`) ? goal.need : p.streak.count;
    case "puzzles":
      return p.puzzles.solved;
    case "rank":
      return p.xp;
    case "bot":
      return STRONG_BOTS.reduce((n, b) => n + (p.bots[b]?.won ?? 0), 0);
  }
}

/** Progress towards an icon. Whatever icon is in use stays unlocked. */
export function iconUnlock(state: LocalState, id: AppIconId | string): IconUnlock {
  const goal = ICON_GOALS[id as AppIconId] ?? null;
  if (!goal) return { goal: null, have: 0, need: 0, unlocked: true, fraction: 1 };
  const n = Math.max(0, have(state, goal));
  const unlocked = n >= goal.need || state.prefs.appIcon === id;
  return { goal, have: Math.min(n, goal.need), need: goal.need, unlocked, fraction: unlocked ? 1 : Math.min(1, n / goal.need) };
}

/** How to unlock an icon and how far along the learner is, in the current language. `botName` is the level-3 bot's name. */
export function iconGoalText(u: IconUnlock, botName: string): { goal: string; progress: string } {
  const g = u.goal;
  const t = copy.looks;
  if (!g) return { goal: t.iconDefault, progress: "" };
  const goal = g.kind === "lesson" ? t.iconGoal.lesson : g.kind === "streak" ? t.iconGoal.streak(g.need) : g.kind === "puzzles" ? t.iconGoal.puzzles(g.need) : g.kind === "rank" ? t.iconGoal.rank(copy.ranks[g.rank]) : t.iconGoal.bot(botName);
  const progress = u.unlocked ? t.iconOpen : g.kind === "rank" ? t.iconXp(u.have, u.need) : t.iconProgress(u.have, u.need);
  return { goal, progress };
}
