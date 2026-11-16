/**
 * Weekly leagues: groups of up to LEAGUE_SIZE learners in the same tier, ranked by XP earned from
 * Monday 00:00 to Sunday 23:59 India time. The server keeps the tables; this file is the shared rules.
 */
export const LEAGUE_TIERS = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;
export type LeagueTier = (typeof LEAGUE_TIERS)[number];
export const LEAGUE_SIZE = 30;
export const PROMOTE = 7;
export const RELEGATE = 5;
/** Most XP one learner can add to a league in one India day. */
export const LEAGUE_DAY_CAP = 400;

/** India Standard Time is UTC+5:30 all year (no daylight saving). */
const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** India calendar day (YYYY-MM-DD) of an instant. */
export const indiaDay = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);

/** The league week an instant falls in, named by its Monday in India. */
export function leagueWeek(ms: number): string {
  const d = new Date(ms + IST_MS);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

/** When a week closes: the next Monday 00:00 in India, as epoch ms. */
export function weekClosesAt(week: string): number {
  const [y, m, d] = week.split("-").map(Number);
  return Date.UTC(y, m - 1, d + 7) - IST_MS;
}

export const nextWeek = (week: string) => leagueWeek(weekClosesAt(week));

/** `H:MM:SS`-free countdown parts until the close, for "2d 4h left". */
export function closesIn(week: string, nowMs: number): { days: number; hours: number; minutes: number } {
  const left = Math.max(0, weekClosesAt(week) - nowMs);
  return { days: Math.floor(left / DAY_MS), hours: Math.floor((left % DAY_MS) / 3_600_000), minutes: Math.floor((left % 3_600_000) / 60_000) };
}

export type LeagueRow = { userId: string; xp: number; updatedAt: number };
export type Zone = "up" | "down" | "stay";

/** Table order: most XP first; a tie goes to whoever got there first, then by id so it is stable. */
export const rankLeague = <T extends LeagueRow>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => b.xp - a.xp || a.updatedAt - b.updatedAt || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));

/**
 * The zone for a place (0-based) in a league of `size` in `tier`. The top PROMOTE move up (with some
 * XP that week; never from King), the bottom RELEGATE move down (never from Pawn). In a small
 * league the zones never overlap: promotion wins.
 */
export function zoneFor(place: number, size: number, tier: number, xp: number): Zone {
  if (place < PROMOTE && tier < LEAGUE_TIERS.length - 1 && xp > 0) return "up";
  if (tier > 0 && place >= Math.max(PROMOTE, size - RELEGATE)) return "down";
  return "stay";
}

/** Each member's tier for next week after a league closes. */
export function settleLeague<T extends LeagueRow>(rows: readonly T[], tier: number): { userId: string; tier: number; zone: Zone }[] {
  const ranked = rankLeague(rows);
  return ranked.map((r, i) => {
    const zone = zoneFor(i, ranked.length, tier, r.xp);
    return { userId: r.userId, tier: zone === "up" ? tier + 1 : zone === "down" ? tier - 1 : tier, zone };
  });
}

/** Next week's leagues: per tier, in join order, groups of LEAGUE_SIZE (numbered from 1). */
export function formLeagues(players: readonly { userId: string; tier: number; joinedAt: number }[]): { userId: string; tier: number; group: number }[] {
  const out: { userId: string; tier: number; group: number }[] = [];
  for (let tier = 0; tier < LEAGUE_TIERS.length; tier++) {
    const inTier = players.filter((p) => p.tier === tier).sort((a, b) => a.joinedAt - b.joinedAt || (a.userId < b.userId ? -1 : 1));
    inTier.forEach((p, i) => out.push({ userId: p.userId, tier, group: Math.floor(i / LEAGUE_SIZE) + 1 }));
  }
  return out;
}

/** First name only, for a league table. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 20) ?? "";
