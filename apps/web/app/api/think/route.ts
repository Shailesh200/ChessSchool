import { NextResponse } from "next/server";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { homeworkLessons } from "@/db/schema";
import { isoDay } from "@chess-school/progression";
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

/** Calculation-trainer position from the homework tactics pool. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const day = url.searchParams.get("day")?.slice(0, 10) || isoDay();
  const offset = Math.max(0, Number(url.searchParams.get("n") ?? 0) || 0);

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

  return NextResponse.json({ day, index: idx, poolSize: pool.length, puzzle });
}
