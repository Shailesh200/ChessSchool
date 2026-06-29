import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { semesters as semT, classes as classT, lessons as lessonT } from "@/db/schema";
import { STAGES } from "@/content/school";
import type { Semester, SchoolClass } from "@/content/school";
import type { Catalog } from "./structure";

/**
 * The live curriculum, read from the DB (the single source of truth — curated +
 * generated + anything added in /admin). Shaped exactly like the old constants
 * so the school logic/UI works unchanged.
 *
 * Pages that call this set `revalidate` (ISR) so the 500+-lesson read is cached
 * between navigations; admin edits call revalidatePath to refresh.
 */
export async function getCatalog(): Promise<Catalog> {
  const [sems, cls, les] = await Promise.all([
    db.select().from(semT).orderBy(asc(semT.sortOrder)),
    db.select().from(classT).orderBy(asc(classT.sortOrder)),
    db
      .select({ id: lessonT.id, classId: lessonT.classId, isExam: lessonT.isExam, title: lessonT.title })
      .from(lessonT)
      .orderBy(asc(lessonT.sortOrder)),
  ]);

  const lessonIdsByClass = new Map<string, string[]>();
  const titles: Record<string, string> = {};
  for (const l of les) {
    titles[l.id] = l.title;
    if (l.isExam) continue; // exams are referenced via class.examId, not lessonIds
    const arr = lessonIdsByClass.get(l.classId) ?? [];
    arr.push(l.id);
    lessonIdsByClass.set(l.classId, arr);
  }

  const classById = new Map(
    cls.map((c) => [
      c.id,
      {
        id: c.id,
        title: c.title,
        emoji: c.emoji,
        blurb: c.blurb,
        difficulty: c.difficulty,
        examId: c.examId ?? undefined,
        lessonIds: lessonIdsByClass.get(c.id) ?? [],
      } as SchoolClass,
    ]),
  );

  // Order curriculum so a beginner builds up properly: per stage, the hand-authored
  // basics come first, then the imported puzzle concepts easiest-first (win material →
  // forks → pins → mates → advanced). Drives both the campus AND the unlock frontier.
  const CONCEPT_ORDER = ["trapped", "fork", "pin", "mate", "discovered", "endgame", "sacrifice", "advantage"];
  const semKey = (s: (typeof sems)[number]) => {
    const stageIdx = STAGES.findIndex((st) => st.id === s.stage);
    let priority = s.sortOrder; // curated keep their relative order (all small)
    if (s.id.startsWith("pz-")) {
      const gi = CONCEPT_ORDER.indexOf(s.id.split("-")[2] ?? "");
      priority = 100 + (gi === -1 ? 50 : gi); // premium always after curated
    }
    return (stageIdx < 0 ? STAGES.length : stageIdx) * 1000 + priority;
  };
  const sortedSems = [...sems].sort((a, b) => semKey(a) - semKey(b));

  const semesters: Semester[] = sortedSems.map((s) => ({
    id: s.id,
    title: s.title,
    blurb: s.blurb,
    color: s.color,
    stage: s.stage,
    classes: cls.filter((c) => c.semesterId === s.id).map((c) => classById.get(c.id)!),
  }));

  // Frontier order = classes flattened in the same curated-first, easiest-first order.
  const allClasses: SchoolClass[] = semesters.flatMap((s) => s.classes);

  return { stages: STAGES, semesters, allClasses, titles };
}
