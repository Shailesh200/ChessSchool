import { copy } from "./copy";
import { PATH, rankFor, dayKey, visibleStreak, type LocalState, type RankId } from "./progress";

/**
 * Full-screen celebrations. Anyone can push one (`pushCelebration`); the apps show the queue's
 * first item and call `dismissCelebration`. Each id shows once per device, ever.
 * Ids carry the profile ("main" or a child id) so siblings on one device each get their own.
 */
export type Celebration =
  | { id: string; kind: "unit"; unit: string }
  | { id: string; kind: "rank"; rank: RankId }
  /** `milestone`: crossed a hundred (900, 1000…); otherwise a new personal best. */
  | { id: string; kind: "rating"; rating: number; milestone: boolean }
  | { id: string; kind: "league"; league: string }
  | { id: string; kind: "streak"; days: number };
export type CelebrationKind = Celebration["kind"];

export const CELEBRATIONS_MAX = 5;
export const CELEBRATED_MAX = 300;
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;
/** A new rating high (not a milestone) is celebrated only once the rating has settled a little. */
export const RATING_HIGH_MIN_GAMES = 10;

const profileOf = (s: LocalState) => s.activeChild ?? "main";
const RANK_IDS = new Set(["pawn", "knight", "bishop", "rook", "queen", "king"]);

/** Queues `c` unless it is already queued or was shown before. */
export function pushCelebration(s: LocalState, c: Celebration): LocalState {
  if (s.celebrated.includes(c.id) || s.pendingCelebrations.some((p) => p.id === c.id)) return s;
  return { ...s, pendingCelebrations: [...s.pendingCelebrations, c].slice(-CELEBRATIONS_MAX) };
}

/** The learner closed it: never show this id again. */
export function dismissCelebration(s: LocalState, id: string): LocalState {
  return {
    ...s,
    pendingCelebrations: s.pendingCelebrations.filter((c) => c.id !== id),
    celebrated: [...s.celebrated.filter((x) => x !== id), id].slice(-CELEBRATED_MAX),
  };
}

/** Celebrations earned between two states of the same learner (a lesson finished, a rated result). */
export function celebrationsBetween(prev: LocalState, next: LocalState, now: Date): Celebration[] {
  if (profileOf(prev) !== profileOf(next)) return [];
  const who = profileOf(next);
  const out: Celebration[] = [];
  const units = [...new Set(PATH.map((n) => n.unit))];
  for (const unit of units) {
    const done = (s: LocalState) => PATH.filter((n) => n.unit === unit).every((n) => s.progress.completed[n.id]);
    if (!done(prev) && done(next)) out.push({ id: `${who}:unit:${unit}`, kind: "unit", unit });
  }
  const r0 = rankFor(prev.progress.xp);
  const r1 = rankFor(next.progress.xp);
  if (r1.index > r0.index) out.push({ id: `${who}:rank:${r1.rank}`, kind: "rank", rank: r1.rank });
  const today = dayKey(now);
  const s0 = visibleStreak(prev.progress.streak, today);
  const s1 = visibleStreak(next.progress.streak, today);
  for (const days of STREAK_MILESTONES) if (s0 < days && s1 >= days) out.push({ id: `${who}:streak:${days}`, kind: "streak", days });
  const best = prev.ratings.best ?? prev.ratings.player.rating;
  const rating = next.ratings.player.rating;
  if (next.ratings.player.games > prev.ratings.player.games && rating > best) {
    const hundred = Math.floor(rating / 100) * 100;
    if (hundred > Math.floor(best / 100) * 100) out.push({ id: `${who}:rating:${hundred}`, kind: "rating", rating: hundred, milestone: true });
    else if (next.ratings.player.games >= RATING_HIGH_MIN_GAMES) out.push({ id: `${who}:ratingHigh:${dayKey(now)}`, kind: "rating", rating, milestone: false });
  }
  return out;
}

/** `next` with whatever it earned over `prev` queued. */
export function withCelebrations(prev: LocalState, next: LocalState, now: Date): LocalState {
  return celebrationsBetween(prev, next, now).reduce(pushCelebration, next);
}

function isCelebration(v: unknown): v is Celebration {
  const c = v as Celebration;
  if (!c || typeof c !== "object" || typeof c.id !== "string" || c.id.length > 120) return false;
  switch (c.kind) {
    case "unit":
      return typeof c.unit === "string";
    case "rank":
      return RANK_IDS.has(c.rank);
    case "rating":
      return typeof c.rating === "number" && Number.isFinite(c.rating) && typeof c.milestone === "boolean";
    case "league":
      return typeof c.league === "string";
    case "streak":
      return typeof c.days === "number" && Number.isFinite(c.days);
    default:
      return false;
  }
}

export const sanitizeCelebrations = (raw: unknown): Celebration[] => (Array.isArray(raw) ? raw.filter(isCelebration).slice(-CELEBRATIONS_MAX) : []);
export const sanitizeCelebrated = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && id.length <= 120).slice(-CELEBRATED_MAX) : []);

/** The headline and line for a celebration, in the app language. `unitTitle` comes from the served course when known. */
export function celebrationText(c: Celebration, unitTitle?: string): { title: string; body: string } {
  const t = copy.celebrate;
  switch (c.kind) {
    case "unit":
      return { title: t.unit.title(unitTitle ?? copy.units[c.unit as keyof typeof copy.units]?.title ?? c.unit), body: t.unit.body };
    case "rank":
      return { title: t.rank.title(copy.ranks[c.rank]), body: t.rank.body };
    case "rating":
      return c.milestone ? { title: t.rating.title(c.rating), body: t.rating.body } : { title: t.ratingHigh.title(c.rating), body: t.ratingHigh.body };
    case "league":
      return { title: t.league.title((copy.ranks as Record<string, string>)[c.league] ?? c.league), body: t.league.body };
    case "streak":
      return { title: t.streak.title(c.days), body: t.streak.body };
  }
}

/** Share text for a celebration: the headline and the site link, never a name. */
export const celebrationShare = (c: Celebration, unitTitle?: string) => copy.celebrate.shareText(celebrationText(c, unitTitle).title);
