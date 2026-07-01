import { redirect } from "next/navigation";
import { getCatalog } from "@/features/school/catalog.server";
import { PlacementTest, type PlacementStage } from "@/features/placement/PlacementTest";
import { getPlacementPuzzles } from "@/lib/placement-pool";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["elementary", "middle", "high"];

export default async function PlacementPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/placement");

  const catalog = await getCatalog();
  const stages: PlacementStage[] = STAGE_ORDER.map((id) => {
    const stage = catalog.stages.find((s) => s.id === id);
    const classIds = catalog.semesters.filter((s) => s.stage === id).flatMap((s) => s.classes.map((c) => c.id));
    return { id, name: stage?.name ?? id, classIds };
  }).filter((s) => s.classIds.length > 0);

  const puzzles = await getPlacementPuzzles();
  const questions = puzzles.map((p) => ({
    fen: p.fen,
    solution: p.solution[0] ?? "",
    orientation: "white" as const,
  }));

  return <PlacementTest questions={questions} stages={stages} />;
}
