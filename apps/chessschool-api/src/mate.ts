import { asc, eq, like, sql } from "drizzle-orm";
import type { Db } from "./db";
import { mateDays, puzzles } from "./schema";

export type MatePuzzle = { id: string; fen: string; moves: string[] };

/** Same small hash as the daily puzzle (FNV-1a), so a day always maps to the same mate. */
function dayHash(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The mate of the day (India date): one mate-in-two from the puzzle table, the same for everyone.
 * Mate-in-two lines are four moves: the opponent's set-up, the learner, the reply, the mate.
 */
export async function mateOfDay(db: Db, day: string): Promise<MatePuzzle | null> {
  const rows = await db.select({ id: puzzles.id, fen: puzzles.fen, moves: puzzles.moves }).from(puzzles).where(like(puzzles.themes, '%"mateIn2"%')).orderBy(asc(puzzles.id));
  const pool = rows.map((r) => ({ id: r.id, fen: r.fen, moves: JSON.parse(r.moves) as string[] })).filter((p) => p.moves.length === 4);
  return pool.length ? pool[dayHash(`mate:${day}`) % pool.length] : null;
}

export async function mateCounts(db: Db, day: string): Promise<{ played: number; solved: number }> {
  const row = await db.query.mateDays.findFirst({ where: eq(mateDays.day, day) });
  return { played: row?.played ?? 0, solved: row?.solved ?? 0 };
}

/** One finished mate of the day, counted in aggregate only. */
export async function countMate(db: Db, day: string, solved: boolean): Promise<void> {
  const s = solved ? 1 : 0;
  await db
    .insert(mateDays)
    .values({ day, played: 1, solved: s })
    .onConflictDoUpdate({ target: mateDays.day, set: { played: sql`${mateDays.played} + 1`, solved: sql`${mateDays.solved} + ${s}` } });
}
