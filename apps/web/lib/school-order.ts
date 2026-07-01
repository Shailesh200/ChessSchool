import { STAGES } from "@/content/school";

export const STAGE_ORDER = STAGES.map((s) => s.id);

export function isOptionalStage(stageId: string): boolean {
  return Boolean(STAGES.find((s) => s.id === stageId)?.optional);
}

type SemRow = { id: string; stage: string; sortOrder: number; title: string };
type ClassRow = { id: string; semesterId: string; sortOrder: number; title: string };

/** Global class order: stage ladder → semester sortOrder → class sortOrder. */
export function orderClasses(sems: SemRow[], cls: ClassRow[]): ClassRow[] {
  const semById = new Map(sems.map((s) => [s.id, s]));
  const stageRank = (semId: string) => STAGE_ORDER.indexOf(semById.get(semId)?.stage ?? "");
  return [...cls].sort(
    (a, b) =>
      stageRank(a.semesterId) - stageRank(b.semesterId) ||
      (semById.get(a.semesterId)?.sortOrder ?? 0) - (semById.get(b.semesterId)?.sortOrder ?? 0) ||
      a.sortOrder - b.sortOrder,
  );
}

/** Skip optional stages the student hasn't started (Pre-School is skippable). */
export function shouldSkipSemester(
  sem: SemRow,
  classIds: string[],
  mastery: Record<string, number>,
  lessonClassById: Map<string, string>,
): boolean {
  if (!isOptionalStage(sem.stage)) return false;
  return !classIds.some((classId) =>
    [...lessonClassById.entries()].some(([lessonId, cid]) => cid === classId && lessonId in mastery),
  );
}
