"use client";

import Dexie, { type EntityTable } from "dexie";
import { normalizeSyncGame } from "@chess-school/progression";
import { syncTrigger } from "@/core/sync/syncTrigger";
import {
  legacyOwner,
  ownedBy,
  reconcileRows,
  rowOwnerNow,
  type Owned,
} from "@/core/sync/rowOwner";

/**
 * Local-first persistence (IndexedDB via Dexie). Holds finished games for the
 * review/replay history and the spaced-repetition review queue. Zero network.
 *
 * Every row is tagged with its `owner` (the user id when it was queued, see
 * core/sync/rowOwner.ts) and is read, pushed or kept only for that user. A logout or an
 * account deletion clears all three tables (clearLocalRows), and a sign-in drops what is
 * not the user's (reconcileLocalRows). `owner` is not an index and never leaves the device.
 */

export type EndReason =
  "checkmate" | "resign" | "stalemate" | "draw" | "insufficient" | "timeout";

export interface SavedGame {
  id: string;
  mode: "bot" | "pass" | "sandbox" | "online" | "shadow";
  pgn: string;
  fen: string;
  whiteName: string;
  blackName: string;
  createdAt: number;
  updatedAt: number;
  turn: "w" | "b";
  result: string; // "1-0" | "0-1" | "1/2-1/2"
  endReason: EndReason;
  winner: "w" | "b" | null;
  moveCount: number;
  elo: number | null;
  durationMs: number;
  /** User id this row belongs to (see rowOwner.ts). Set when the row is queued. */
  owner?: string;
}

export interface ReviewItem {
  id: string;
  kind: "lesson" | "puzzle";
  dueAt: number;
  tag: string;
  ease: number;
  owner?: string;
}

export interface JournalEntry {
  id: string;
  day: string; // YYYY-MM-DD
  date: number; // epoch ms
  kind: "lesson" | "match" | "review" | "exam" | "reflection";
  title: string;
  confidence: number; // 1..5
  note: string;
  summary: string; // coach-generated
  ref: string | null; // lesson/game id
  owner?: string;
}

const db = new Dexie("chessschool") as Dexie & {
  games: EntityTable<SavedGame, "id">;
  reviews: EntityTable<ReviewItem, "id">;
  journal: EntityTable<JournalEntry, "id">;
};

db.version(1).stores({
  games: "id, mode, updatedAt",
  reviews: "id, dueAt, kind, tag",
});
// v2 keeps the same indexes but the record shape gained review fields.
db.version(2).stores({
  games: "id, mode, updatedAt, createdAt",
  reviews: "id, dueAt, kind, tag",
});
// v3 adds the learning journal.
db.version(3).stores({
  games: "id, mode, updatedAt, createdAt",
  reviews: "id, dueAt, kind, tag",
  journal: "id, day, date, kind",
});

export { db };

export async function saveGame(game: SavedGame): Promise<void> {
  await db.games.put({ ...game, owner: rowOwnerNow() });
  syncTrigger();
}

export async function listGames(): Promise<SavedGame[]> {
  const rows = await db.games.orderBy("updatedAt").reverse().toArray();
  return ownedBy(rows, rowOwnerNow());
}

export async function getGame(id: string): Promise<SavedGame | undefined> {
  const row = await db.games.get(id);
  return row && ownedBy([row], rowOwnerNow()).length ? row : undefined;
}

export async function deleteGame(id: string): Promise<void> {
  await db.games.delete(id);
}

export async function dueReviews(now = Date.now()): Promise<ReviewItem[]> {
  const rows = await db.reviews.where("dueAt").belowOrEqual(now).toArray();
  return ownedBy(rows, rowOwnerNow());
}

export async function upsertReview(item: ReviewItem): Promise<void> {
  await db.reviews.put({ ...item, owner: rowOwnerNow() });
}

export async function addJournalEntry(entry: JournalEntry): Promise<void> {
  await db.journal.put({ ...entry, owner: rowOwnerNow() });
  syncTrigger();
}

export async function listJournal(): Promise<JournalEntry[]> {
  const rows = await db.journal.orderBy("date").reverse().toArray();
  return ownedBy(rows, rowOwnerNow());
}

/** Replace local journal with account snapshot (pull sync). The rows are `owner`'s. */
export async function replaceJournalEntries(
  entries: JournalEntry[],
  owner: string,
): Promise<void> {
  await db.journal.clear();
  if (entries.length) await db.journal.bulkAdd(entries.map((e) => ({ ...e, owner })));
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await db.journal.delete(id);
}

/** Logout or account deletion: nothing of the user's rows stays on the device. */
export async function clearLocalRows(): Promise<void> {
  await db.transaction("rw", db.games, db.reviews, db.journal, async () => {
    await db.games.clear();
    await db.reviews.clear();
    await db.journal.clear();
  });
}

/**
 * `userId` signed in (a pull succeeded for them): keep their rows, and a guest's when the
 * account is new (`adoptGuest`); delete everyone else's. `legacy` is who untagged rows
 * belonged to, read before the session markers were rewritten. The rows that stay are
 * tagged with `userId`, so an untagged row is never left to be claimed by the next user.
 */
export async function reconcileLocalRows(
  userId: string,
  adoptGuest: boolean,
  legacy: string = legacyOwner(),
): Promise<void> {
  await db.transaction("rw", db.games, db.reviews, db.journal, async () => {
    for (const table of [db.games, db.reviews, db.journal] as unknown as {
      toArray(): Promise<(Owned & { id: string })[]>;
      bulkDelete(ids: string[]): Promise<void>;
      bulkPut(rows: (Owned & { id: string })[]): Promise<unknown>;
    }[]) {
      const { keep, drop } = reconcileRows(
        await table.toArray(),
        userId,
        adoptGuest,
        legacy,
      );
      if (drop.length) await table.bulkDelete(drop.map((r) => r.id));
      if (keep.length) await table.bulkPut(keep);
    }
  });
}

function syncToSavedGame(g: ReturnType<typeof normalizeSyncGame>): SavedGame {
  return {
    id: g!.id,
    mode: g!.mode,
    pgn: g!.pgn,
    fen: g!.fen,
    whiteName: g!.whiteName,
    blackName: g!.blackName,
    createdAt: g!.createdAt,
    updatedAt: g!.updatedAt,
    turn: g!.turn ?? "w",
    result: g!.result,
    endReason: g!.endReason ?? "draw",
    winner: g!.winner ?? null,
    moveCount: g!.moveCount,
    elo: g!.elo,
    durationMs: g!.durationMs ?? 0,
  };
}

/**
 * Merge the account game snapshot into local history.
 * `owner`'s rows that are not in the snapshot stay: a game can be on the device
 * before the account has it, and clearing the table here made `/review/<id>`
 * miss that game after the next pull. Every other row is removed, so another
 * user's game does not remain. Untagged rows are not kept.
 */
export async function replaceGamesFromSync(
  recentGames: unknown[],
  owner: string,
): Promise<void> {
  const games = recentGames
    .map(normalizeSyncGame)
    .filter((g): g is NonNullable<typeof g> => g !== null);
  await db.transaction("rw", db.games, async () => {
    const existing = await db.games.toArray();
    const drop = existing.filter((row) => row.owner !== owner);
    if (drop.length) await db.games.bulkDelete(drop.map((row) => row.id));
    for (const g of games) await db.games.put({ ...syncToSavedGame(g), owner });
  });
}
