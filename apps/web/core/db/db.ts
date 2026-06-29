"use client";

import Dexie, { type EntityTable } from "dexie";

/**
 * Local-first persistence (IndexedDB via Dexie). Holds finished games for the
 * review/replay history and the spaced-repetition review queue. Zero network.
 */

export type EndReason =
  | "checkmate"
  | "resign"
  | "stalemate"
  | "draw"
  | "insufficient"
  | "timeout";

export interface SavedGame {
  id: string;
  mode: "bot" | "pass" | "sandbox" | "online";
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
}

export interface ReviewItem {
  id: string;
  kind: "lesson" | "puzzle";
  dueAt: number;
  tag: string;
  ease: number;
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
  await db.games.put(game);
}

export async function listGames(): Promise<SavedGame[]> {
  return db.games.orderBy("updatedAt").reverse().toArray();
}

export async function getGame(id: string): Promise<SavedGame | undefined> {
  return db.games.get(id);
}

export async function deleteGame(id: string): Promise<void> {
  await db.games.delete(id);
}

export async function dueReviews(now = Date.now()): Promise<ReviewItem[]> {
  return db.reviews.where("dueAt").belowOrEqual(now).toArray();
}

export async function upsertReview(item: ReviewItem): Promise<void> {
  await db.reviews.put(item);
}

export async function addJournalEntry(entry: JournalEntry): Promise<void> {
  await db.journal.put(entry);
}

export async function listJournal(): Promise<JournalEntry[]> {
  return db.journal.orderBy("date").reverse().toArray();
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await db.journal.delete(id);
}
