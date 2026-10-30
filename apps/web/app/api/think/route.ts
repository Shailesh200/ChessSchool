import { NextResponse } from "next/server";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { homeworkLessons } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { LessonStep } from "@/features/lessons/types";
import {
  firstMoveStep,
  pickIndex,
  puzzleFromStep,
} from "@/features/play/calculationPuzzle";

export const dynamic = "force-dynamic";

type PoolEntry = {
  id: string;
  title: string;
  tag: string;
  emoji: string;
  stepIndex: number;
  step: LessonStep;
};

let cachedPool: PoolEntry[] | null = null;
let poolLoad: Promise<PoolEntry[]> | null = null;

async function buildHomeworkPool(): Promise<PoolEntry[]> {
  const rows = await db
    .select({
      id: homeworkLessons.id,
      title: homeworkLessons.title,
      tag: homeworkLessons.tag,
      emoji: homeworkLessons.emoji,
      steps: homeworkLessons.steps,
    })
    .from(homeworkLessons)
    .where(inArray(homeworkLessons.type, ["practice", "review"]))
    .orderBy(asc(homeworkLessons.sortOrder));

  const pool: PoolEntry[] = [];
  for (const row of rows) {
    let steps: LessonStep[];
    try {
      steps = JSON.parse(row.steps) as LessonStep[];
    } catch {
      continue;
    }
    const hit = firstMoveStep(steps);
    if (!hit) continue;
    pool.push({
      id: row.id,
      title: row.title,
      tag: row.tag,
      emoji: row.emoji,
      stepIndex: hit.index,
      step: hit.step,
    });
  }
  return pool;
}

function homeworkPool(): Promise<PoolEntry[]> {
  if (cachedPool) return Promise.resolve(cachedPool);
  if (!poolLoad) {
    poolLoad = buildHomeworkPool().then((pool) => {
      cachedPool = pool;
      return pool;
    });
  }
  return poolLoad;
}

/** Reset cached pool — tests only. */
export function resetThinkPoolForTests(): void {
  cachedPool = null;
  poolLoad = null;
}

/** Calculation-trainer position from the homework tactics pool. */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) {
    const limited = await enforceRateLimit(req, "think:guest", {
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;
  } else {
    const limited = await enforceRateLimit(req, "think:puzzle", {
      limit: 120,
      windowMs: 60_000,
    }, user.id);
    if (limited) return limited;
  }

  const url = new URL(req.url);
  const { resolveRequestedDay } = await import("@chess-school/progression");
  const day = resolveRequestedDay(url.searchParams.get("day"));
  if (day === null) {
    return NextResponse.json({ error: "invalid_day" }, { status: 400 });
  }
  const offset = Math.max(0, Number(url.searchParams.get("n") ?? 0) || 0);

  const pool = await homeworkPool();
  if (!pool.length) {
    return NextResponse.json({ error: "no_puzzles" }, { status: 404 });
  }

  const idx = pickIndex(pool.length, `${day}:${offset}`);
  const picked = pool[idx]!;
  const puzzle = puzzleFromStep(
    { id: picked.id, title: picked.title, tag: picked.tag, emoji: picked.emoji },
    picked.stepIndex,
    picked.step,
  );

  if (!puzzle) {
    return NextResponse.json({ error: "invalid_puzzle" }, { status: 500 });
  }

  return NextResponse.json(
    { day, index: idx, poolSize: pool.length, puzzle },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
