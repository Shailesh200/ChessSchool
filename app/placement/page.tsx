import { like } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { getCatalog } from "@/features/school/catalog.server";
import { PlacementTest, type PlacementQuestion, type PlacementStage } from "@/features/placement/PlacementTest";
import type { LessonStep } from "@/features/lessons/types";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["elementary", "middle", "high"];

async function questionsFrom(prefix: string, n: number): Promise<PlacementQuestion[]> {
  const rows = await db
    .select({ steps: lessons.steps })
    .from(lessons)
    .where(like(lessons.classId, `${prefix}%`))
    .limit(30);
  const moves = rows
    .flatMap((r) => JSON.parse(r.steps) as LessonStep[])
    .filter((s) => s.kind === "move" && s.fen && s.solution?.[0]);
  // spread the picks across the pool for variety
  const out: PlacementQuestion[] = [];
  for (let k = 0; k < n && moves.length; k++) {
    const s = moves[Math.floor((k * moves.length) / n)]!;
    out.push({ fen: s.fen!, solution: s.solution![0]!, orientation: s.orientation });
  }
  return out;
}

export default async function PlacementPage() {
  const catalog = await getCatalog();
  const stages: PlacementStage[] = STAGE_ORDER.map((id) => {
    const stage = catalog.stages.find((s) => s.id === id);
    const classIds = catalog.semesters.filter((s) => s.stage === id).flatMap((s) => s.classes.map((c) => c.id));
    return { id, name: stage?.name ?? id, classIds };
  }).filter((s) => s.classIds.length > 0);

  // Easy → hard puzzles.
  const questions = [
    ...(await questionsFrom("sem-gen-promo-", 2)),
    ...(await questionsFrom("sem-gen-captures-", 2)),
    ...(await questionsFrom("sem-gen-checks-", 2)),
    ...(await questionsFrom("sem-gen-mates-", 2)),
  ];

  return <PlacementTest questions={questions} stages={stages} />;
}
