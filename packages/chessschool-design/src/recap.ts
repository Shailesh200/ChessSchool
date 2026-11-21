import type { GameRecord, LocalState } from "./progress";

/**
 * Weekly recap: every Monday, a look back at last week (Monday to Sunday, local days). The device keeps
 * the learner's running totals as they stood when each week was first opened; last week's numbers are the
 * difference between this week's mark and last week's. Lessons and games are counted from their own days.
 */
export type WeekTotals = { xp: number; puzzles: number; rating: number; dailyStreak: number };
export type WeekMark = { week: string; totals: WeekTotals };
export type RecapBest = { kind: "win"; bot: string; rating: number } | { kind: "daily"; days: number } | { kind: "lessons"; count: number } | null;
export type WeeklyRecap = { week: string; to: string; xp: number; lessons: number; puzzles: number; games: number; wins: number; ratingChange: number; best: RecapBest };

/** How many week marks the device keeps (this week's and last week's). */
export const WEEK_MARKS = 2;
/** The recap card shows on Today from Monday through this many days after it, until it is closed. */
export const RECAP_DAYS = 3;

const utc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The Monday on or before a local day key. */
export function weekStart(day: string): string {
  const ms = utc(day);
  const dow = (new Date(ms).getUTCDay() + 6) % 7;
  return fromUtc(ms - dow * 86_400_000);
}
const addDays = (day: string, n: number) => fromUtc(utc(day) + n * 86_400_000);

const totalsOf = (s: LocalState): WeekTotals => ({
  xp: s.progress.xp,
  puzzles: s.progress.puzzles.solved,
  rating: Math.round(s.ratings.player.rating),
  dailyStreak: s.progress.puzzles.daily.count,
});

/** Records this week's starting totals the first time the app opens in a new week (call when the app opens). */
export function markWeek(s: LocalState, today: string): LocalState {
  const week = weekStart(today);
  const weeks = s.habit.weeks ?? [];
  if (weeks[0]?.week === week) return s;
  return { ...s, habit: { ...s.habit, weeks: [{ week, totals: totalsOf(s) }, ...weeks.filter((w) => w.week < week)].slice(0, WEEK_MARKS) } };
}

export function sanitizeWeeks(raw: unknown): WeekMark[] {
  if (!Array.isArray(raw)) return [];
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0);
  return raw
    .filter((w) => w && typeof w === "object" && typeof w.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w.week) && w.totals && typeof w.totals === "object")
    .map((w) => ({ week: w.week as string, totals: { xp: n(w.totals.xp), puzzles: n(w.totals.puzzles), rating: n(w.totals.rating), dailyStreak: n(w.totals.dailyStreak) } }))
    .slice(0, WEEK_MARKS);
}

const inWeek = (day: string, from: string, to: string) => day >= from && day <= to;
const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Last week's recap, or null when the device was not opened last week (nothing to compare with) or
 * nothing happened. `botRating` names the strongest bot beaten (from @chessschool/chess).
 */
export function weeklyRecap(s: LocalState, today: string, botRating: (bot: string) => number): WeeklyRecap | null {
  const thisWeek = weekStart(today);
  const lastWeek = addDays(thisWeek, -7);
  const [now, prev] = s.habit.weeks ?? [];
  if (!now || !prev || now.week !== thisWeek || prev.week !== lastWeek) return null;
  const to = addDays(thisWeek, -1);
  const placed = new Set(s.progress.placed);
  const lessons = Object.entries(s.progress.completed).filter(([id, day]) => id !== "meet" && !placed.has(id) && inWeek(day, lastWeek, to)).length;
  const games = s.gameLog.filter((g: GameRecord) => g.reason !== "imported" && g.reason !== "scanned" && inWeek(localDay(g.endedAt), lastWeek, to));
  const wins = games.filter((g) => g.setup.opponent.kind === "bot" && g.winner === g.setup.you);
  const recap = {
    week: lastWeek,
    to,
    xp: Math.max(0, now.totals.xp - prev.totals.xp),
    lessons,
    puzzles: Math.max(0, now.totals.puzzles - prev.totals.puzzles),
    games: games.length,
    wins: wins.length,
    ratingChange: now.totals.rating - prev.totals.rating,
  };
  if (!recap.xp && !recap.lessons && !recap.puzzles && !recap.games) return null;
  let best: RecapBest = null;
  for (const g of wins) {
    if (g.setup.opponent.kind !== "bot") continue;
    const rating = botRating(g.setup.opponent.bot);
    if (!best || (best.kind === "win" && rating > best.rating)) best = { kind: "win", bot: g.setup.opponent.bot, rating };
  }
  if (!best && Math.max(now.totals.dailyStreak, prev.totals.dailyStreak) >= 3) best = { kind: "daily", days: now.totals.dailyStreak };
  if (!best && lessons >= 2) best = { kind: "lessons", count: lessons };
  return { ...recap, best };
}

/** Whether the recap card belongs on Today: Monday to Wednesday, until it is closed. */
export const showRecapCard = (s: LocalState, recap: WeeklyRecap | null, today: string) => Boolean(recap && s.habit.recapSeen !== recap.week && utc(today) - utc(weekStart(today)) < RECAP_DAYS * 86_400_000);

export const closeRecap = (s: LocalState, week: string): LocalState => ({ ...s, habit: { ...s.habit, recapSeen: week } });
