import { db } from "@/db";
import { lessons } from "@/db/schema";

export type PlacementPuzzle = { fen: string; solution: string[] };

let cached: PlacementPuzzle[] | null = null;
let cachedAt = 0;
const TTL_MS = 3600_000;

/** Cached pool of ~8 spread puzzles for placement tests. */
export async function getPlacementPuzzles(): Promise<PlacementPuzzle[]> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;

  const rows = await db.select({ steps: lessons.steps }).from(lessons).limit(600);
  const all: PlacementPuzzle[] = [];
  for (const r of rows) {
    try {
      for (const s of JSON.parse(r.steps) as { kind?: string; fen?: string; solution?: string[] }[]) {
        if (s.kind === "move" && s.fen && s.solution?.length) {
          all.push({ fen: s.fen, solution: s.solution });
          break;
        }
      }
    } catch {
      /* skip malformed */
    }
    if (all.length >= 240) break;
  }
  const stride = Math.max(1, Math.floor(all.length / 8));
  const puzzles: PlacementPuzzle[] = [];
  for (let i = 0; i < all.length && puzzles.length < 8; i += stride) puzzles.push(all[i]!);

  cached = puzzles;
  cachedAt = Date.now();
  return puzzles;
}

export function clearPlacementCache(): void {
  cached = null;
  cachedAt = 0;
}
