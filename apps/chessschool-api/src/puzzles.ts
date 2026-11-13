import { asc, eq, notInArray } from "drizzle-orm";
import type { Db } from "./db";
import { puzzles } from "./schema";

export const PUZZLE_CACHE = "public, max-age=300, stale-while-revalidate=86400";
export const puzzleEtag = (version: string) => `"${version}"`;

export type Puzzle = { id: string; fen: string; moves: string[]; rating: number; themes: string[] };
export type PuzzlePack = { version: string; puzzles: Puzzle[] };

export type PackIssue = { ok: false; errors: string[] };
export type PackOk = { ok: true; pack: PuzzlePack };

const fenFields = (fen: string) => fen.trim().split(/\s+/).length === 6;

export function parsePuzzlePack(raw: string): PackOk | PackIssue {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ["pack is not JSON"] };
  }
  if (!body || typeof body !== "object") return { ok: false, errors: ["pack must be an object"] };
  const version = (body as { version?: unknown }).version;
  const rows = (body as { puzzles?: unknown }).puzzles;
  const errors: string[] = [];
  if (typeof version !== "string" || !version.trim() || version.includes('"')) errors.push("version must be a non-empty string");
  if (!Array.isArray(rows)) return { ok: false, errors: [...errors, "puzzles must be an array"] };
  const seen = new Set<string>();
  const parsed: Puzzle[] = [];
  rows.forEach((row, index) => {
    const label = `puzzles[${index}]`;
    if (!row || typeof row !== "object") {
      errors.push(`${label} must be an object`);
      return;
    }
    const item = row as { id?: unknown; fen?: unknown; moves?: unknown; rating?: unknown; themes?: unknown };
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id) errors.push(`${label} id must be a non-empty string`);
    else if (seen.has(id)) errors.push(`duplicate id: ${id}`);
    else seen.add(id);
    if (typeof item.fen !== "string" || !fenFields(item.fen)) errors.push(`${label} fen must have 6 fields`);
    if (!Array.isArray(item.moves) || item.moves.length === 0 || item.moves.some((move) => typeof move !== "string" || !move.trim())) errors.push(`${label} moves must be a non-empty array of strings`);
    if (typeof item.rating !== "number" || !Number.isInteger(item.rating)) errors.push(`${label} rating must be an integer`);
    if (!Array.isArray(item.themes) || item.themes.some((theme) => typeof theme !== "string")) errors.push(`${label} themes must be an array of strings`);
    if (!id || typeof item.fen !== "string" || !Array.isArray(item.moves) || typeof item.rating !== "number" || !Array.isArray(item.themes)) return;
    parsed.push({
      id,
      fen: item.fen.trim(),
      moves: item.moves.map((move) => move.trim()),
      rating: item.rating,
      themes: item.themes,
    });
  });
  if (errors.length || typeof version !== "string") return { ok: false, errors };
  return { ok: true, pack: { version: version.trim(), puzzles: parsed } };
}

export type PuzzleCounts = { insert: number; update: number; delete: number };

type Stored = { id: string; fen: string; moves: string; rating: number; themes: string; packVersion: string };

function sameRow(prev: Stored, next: Puzzle, version: string): boolean {
  return prev.fen === next.fen && prev.moves === JSON.stringify(next.moves) && prev.rating === next.rating && prev.themes === JSON.stringify(next.themes) && prev.packVersion === version;
}

export function puzzleDiff(existing: Stored[], pack: PuzzlePack): { counts: PuzzleCounts; insert: Puzzle[]; update: Puzzle[]; deleteIds: string[] } {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const nextIds = new Set(pack.puzzles.map((puzzle) => puzzle.id));
  const insert: Puzzle[] = [];
  const update: Puzzle[] = [];
  for (const puzzle of pack.puzzles) {
    const prev = byId.get(puzzle.id);
    if (!prev) insert.push(puzzle);
    else if (!sameRow(prev, puzzle, pack.version)) update.push(puzzle);
  }
  const deleteIds = existing.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
  return { counts: { insert: insert.length, update: update.length, delete: deleteIds.length }, insert, update, deleteIds };
}

export async function readPuzzleRows(db: Db): Promise<Stored[]> {
  return db.select().from(puzzles);
}

/** Writes only the rows that differ. An unchanged pack performs no statements inside a transaction. */
export async function applyPuzzlePack(db: Db, pack: PuzzlePack): Promise<PuzzleCounts> {
  const plan = puzzleDiff(await readPuzzleRows(db), pack);
  if (plan.counts.insert + plan.counts.update + plan.counts.delete === 0) return plan.counts;
  const client = db.$client;
  await client.execute("BEGIN");
  try {
    if (plan.deleteIds.length && pack.puzzles.length) await db.delete(puzzles).where(notInArray(puzzles.id, pack.puzzles.map((puzzle) => puzzle.id)));
    if (plan.deleteIds.length && !pack.puzzles.length) await db.delete(puzzles);
    for (const puzzle of [...plan.insert, ...plan.update]) {
      const values = { id: puzzle.id, fen: puzzle.fen, moves: JSON.stringify(puzzle.moves), rating: puzzle.rating, themes: JSON.stringify(puzzle.themes), packVersion: pack.version };
      await db.insert(puzzles).values(values).onConflictDoUpdate({
        target: puzzles.id,
        set: { fen: values.fen, moves: values.moves, rating: values.rating, themes: values.themes, packVersion: values.packVersion },
      });
    }
    await client.execute("COMMIT");
  } catch (err) {
    await client.execute("ROLLBACK");
    throw err;
  }
  return plan.counts;
}

function toPuzzle(row: Stored): Puzzle {
  return { id: row.id, fen: row.fen, moves: JSON.parse(row.moves) as string[], rating: row.rating, themes: JSON.parse(row.themes) as string[] };
}

export async function loadPuzzlePack(db: Db): Promise<{ version: string; puzzles: Puzzle[] } | null> {
  const rows = await db.select().from(puzzles).orderBy(asc(puzzles.id));
  if (!rows.length) return null;
  return { version: rows[0]!.packVersion, puzzles: rows.map(toPuzzle) };
}

export async function loadPuzzle(db: Db, id: string): Promise<Puzzle | null> {
  const row = await db.query.puzzles.findFirst({ where: eq(puzzles.id, id) });
  return row ? toPuzzle(row) : null;
}
