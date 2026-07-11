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
  const stageRank = (semId: string) =>
    STAGE_ORDER.indexOf(semById.get(semId)?.stage ?? "");
  return [...cls].sort(
    (a, b) =>
      stageRank(a.semesterId) - stageRank(b.semesterId) ||
      (semById.get(a.semesterId)?.sortOrder ?? 0) -
        (semById.get(b.semesterId)?.sortOrder ?? 0) ||
      a.sortOrder - b.sortOrder,
  );
}

/** Skip optional stages only when the student already started the required track. */
export function shouldSkipSemester(
  sem: SemRow,
  classIds: string[],
  mastery: Record<string, number>,
  lessonClassById: Map<string, string>,
  classes: ClassRow[],
  allSems: SemRow[],
): boolean {
  if (!isOptionalStage(sem.stage)) return false;
  const startedHere = classIds.some((classId) =>
    [...lessonClassById.entries()].some(
      ([lessonId, cid]) => cid === classId && lessonId in mastery,
    ),
  );
  if (startedHere) return false;

  const requiredClassIds = new Set(
    classes
      .filter((c) => {
        const s = allSems.find((row) => row.id === c.semesterId);
        return s && !isOptionalStage(s.stage);
      })
      .map((c) => c.id),
  );
  return [...lessonClassById.entries()].some(
    ([lessonId, cid]) => requiredClassIds.has(cid) && lessonId in mastery,
  );
}
