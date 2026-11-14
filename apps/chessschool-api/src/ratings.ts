import { botInfo, isBotId } from "@chessschool/chess";
import { applyResult, emptyRatings, sanitizeRatings, type RatedResult, type Ratings } from "@chessschool/design";
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { ratingEvents, ratings } from "./schema";

const EVENT_ID = /^[\w:.-]{1,80}$/;
const MAX_MOVES = 600;

/** Checks a POST /v1/me/rating body. Returns the event id and result, or null when anything is off. */
export function parseRateInput(b: Record<string, unknown>): { event: string; result: RatedResult } | null {
  if (typeof b.event !== "string" || !EVENT_ID.test(b.event)) return null;
  if (b.kind === "bot") {
    const score = ({ win: 1, draw: 0.5, loss: 0 } as const)[b.result as "win"];
    if (!isBotId(b.bot) || score === undefined) return null;
    if (typeof b.moves !== "number" || !Number.isInteger(b.moves) || b.moves < 1 || b.moves > MAX_MOVES) return null;
    return { event: `game:${b.event}`, result: { kind: "bot", bot: b.bot, target: botInfo(b.bot).rating, score } };
  }
  if (b.kind === "puzzle") {
    if (typeof b.puzzle !== "string" || !EVENT_ID.test(b.puzzle) || typeof b.solved !== "boolean") return null;
    if (typeof b.puzzleRating !== "number" || !Number.isFinite(b.puzzleRating) || b.puzzleRating < 100 || b.puzzleRating > 3000) return null;
    return { event: `puzzle:${b.event}`, result: { kind: "puzzle", puzzleRating: Math.round(b.puzzleRating), solved: b.solved } };
  }
  return null;
}

export async function loadRatings(db: Db, learnerId: string): Promise<Ratings> {
  const row = await db.query.ratings.findFirst({ where: eq(ratings.learnerId, learnerId) });
  if (!row) return emptyRatings();
  try {
    return sanitizeRatings(JSON.parse(row.data));
  } catch {
    return emptyRatings();
  }
}

/** Counts a result once per event id; a repeat returns the stored ratings unchanged. */
export async function rateResult(db: Db, userId: string, learnerId: string, event: string, result: RatedResult, at: number): Promise<{ ratings: Ratings; counted: boolean }> {
  const fresh = await db.insert(ratingEvents).values({ learnerId, event, userId, createdAt: at }).onConflictDoNothing();
  if (!fresh.rowsAffected) return { ratings: await loadRatings(db, learnerId), counted: false };
  const next = applyResult(await loadRatings(db, learnerId), result);
  const data = JSON.stringify(next);
  await db.insert(ratings).values({ learnerId, userId, data, updatedAt: at }).onConflictDoUpdate({ target: ratings.learnerId, set: { data, updatedAt: at } });
  return { ratings: next, counted: true };
}
