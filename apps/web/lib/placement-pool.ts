import { unstable_cache } from "next/cache";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { CURRICULUM_CACHE_TAG } from "@/features/school/curriculum-skeleton.server";

export type PlacementPuzzle = { fen: string; solution: string[] };

const POOL_SIZE = 48;
const DRAW_SIZE = 8;

async function buildPlacementPool(): Promise<PlacementPuzzle[]> {
  const rows = await db
    .select({ steps: lessons.steps })
    .from(lessons)
    .orderBy(asc(lessons.sortOrder))
    .limit(800);

  const all: PlacementPuzzle[] = [];
  const seenFen = new Set<string>();
  for (const r of rows) {
    try {
      for (const s of JSON.parse(r.steps) as {
        kind?: string;
        fen?: string;
        solution?: string[];
      }[]) {
        if (s.kind === "move" && s.fen && s.solution?.length && !seenFen.has(s.fen)) {
          seenFen.add(s.fen);
          all.push({ fen: s.fen, solution: s.solution });
          break;
        }
      }
    } catch {
      /* skip malformed */
    }
    if (all.length >= POOL_SIZE) break;
  }
  return all;
}

const getCachedPlacementPool = unstable_cache(
  buildPlacementPool,
  ["placement-pool-v2"],
  { tags: [CURRICULUM_CACHE_TAG], revalidate: 3600 },
);

/** Draw ~8 distinct puzzles from a cached pool (fresh shuffle each request). */
export async function getPlacementPuzzles(): Promise<PlacementPuzzle[]> {
  const pool = await getCachedPlacementPool();
  if (pool.length <= DRAW_SIZE) return pool;
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, DRAW_SIZE);
}
