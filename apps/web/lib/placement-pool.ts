import { unstable_cache } from "next/cache";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { CURRICULUM_CACHE_TAG } from "@/features/school/curriculum-skeleton.server";

export type PlacementPuzzle = { fen: string; solution: string[] };

async function buildPlacementPuzzles(): Promise<PlacementPuzzle[]> {
  const rows = await db
    .select({ steps: lessons.steps })
    .from(lessons)
    .orderBy(asc(lessons.sortOrder))
    .limit(600);

  const all: PlacementPuzzle[] = [];
  for (const r of rows) {
    try {
      for (const s of JSON.parse(r.steps) as {
        kind?: string;
        fen?: string;
        solution?: string[];
      }[]) {
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
  for (let i = 0; i < all.length && puzzles.length < 8; i += stride)
    puzzles.push(all[i]!);
  return puzzles;
}

const getCachedPlacementPuzzles = unstable_cache(
  buildPlacementPuzzles,
  ["placement-puzzles-v1"],
  { tags: [CURRICULUM_CACHE_TAG], revalidate: 3600 },
);

/** Cached pool of ~8 spread puzzles for placement tests. */
export async function getPlacementPuzzles(): Promise<PlacementPuzzle[]> {
  return getCachedPlacementPuzzles();
}
