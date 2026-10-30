import { inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { homeworkLessons, lessons } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { ProgressPushBody } from "@/lib/api-schemas";
import { getCurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";
import type { ServerProgressState } from "@/lib/progress-merge";

type Db = LibSQLDatabase<typeof schema>;

const MAX_XP_PER_LESSON = 120;
const MAX_XP_PER_PUSH = 500;
const NO_ACTIVITY_XP_CAP = 25;

function lessonRecordFromPush(
  rec: ProgressPushBody["lessons"][string] | undefined,
): { mastery: number; attempts: number; lastSeen: number; dueAt: number } | null {
  if (!rec) return null;
  return {
    mastery: rec.mastery,
    attempts: rec.attempts,
    lastSeen: rec.lastSeen,
    dueAt: rec.dueAt,
  };
}

async function validLessonIds(db: Db, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const curriculum = new Set(
    (
      await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(inArray(lessons.id, ids))
    ).map((r) => r.id),
  );
  const homework = new Set(
    (
      await db
        .select({ id: homeworkLessons.id })
        .from(homeworkLessons)
        .where(inArray(homeworkLessons.id, ids))
    ).map((r) => r.id),
  );
  return new Set([...curriculum, ...homework].filter((id) => ids.includes(id)));
}

function maxXpDeltaForPush(body: ProgressPushBody, server: ServerProgressState): number {
  let delta = 0;
  for (const [lessonId, rec] of Object.entries(body.lessons ?? {})) {
    const prev = server.lessons[lessonId];
    const progressed =
      !prev ||
      rec.mastery > prev.mastery ||
      rec.attempts > prev.attempts ||
      rec.lastSeen > prev.lastSeen;
    if (progressed) delta += MAX_XP_PER_LESSON;
  }
  if (body.botWins != null && body.botWins > (server.extra.botWins ?? 0)) {
    delta += 40;
  }
  if (
    body.dailyPuzzleDay &&
    body.dailyPuzzleDay !== server.extra.dailyPuzzleDay
  ) {
    delta += 30;
  }
  const requested = Math.max(0, body.xp - server.xp);
  if (delta === 0 && requested > 0) {
    delta = Math.min(requested, NO_ACTIVITY_XP_CAP);
  }
  return Math.min(Math.max(delta, 0), MAX_XP_PER_PUSH);
}

async function filterGraduatedClasses(
  db: Db,
  body: ProgressPushBody,
  server: ServerProgressState,
): Promise<string[]> {
  const incoming = body.graduatedClasses ?? [];
  if (!incoming.length) return server.graduatedClasses;
  const mergedLessons: ServerProgressState["lessons"] = { ...server.lessons };
  for (const [id, rec] of Object.entries(body.lessons ?? {})) {
    mergedLessons[id] = {
      mastery: rec.mastery,
      attempts: rec.attempts,
      lastSeen: rec.lastSeen,
      dueAt: rec.dueAt,
    };
  }
  const { classes, lessons: curriculumLessons } = await getCurriculumSkeleton();
  const lessonIdsByClass = new Map<string, string[]>();
  for (const lesson of curriculumLessons) {
    if (lesson.isExam) continue;
    const list = lessonIdsByClass.get(lesson.classId) ?? [];
    list.push(lesson.id);
    lessonIdsByClass.set(lesson.classId, list);
  }
  const validClassIds = new Set(classes.map((c) => c.id));
  const allowed = new Set(server.graduatedClasses);
  for (const classId of incoming) {
    if (!validClassIds.has(classId) || allowed.has(classId)) continue;
    const ids = lessonIdsByClass.get(classId) ?? [];
    if (
      ids.length > 0 &&
      ids.every((id) => (mergedLessons[id]?.mastery ?? 0) >= 0.9)
    ) {
      allowed.add(classId);
    }
  }
  return [...allowed];
}

/** Server-side guardrails before merge — drop forged lessons, XP spikes, and graduations. */
export async function hardenProgressPush(
  body: ProgressPushBody,
  server: ServerProgressState,
  db: Db,
): Promise<ProgressPushBody> {
  const lessonIds = Object.keys(body.lessons ?? {});
  const valid = await validLessonIds(db, lessonIds);
  const lessons: ProgressPushBody["lessons"] = {};
  for (const id of lessonIds) {
    if (valid.has(id)) lessons[id] = body.lessons[id]!;
  }

  const maxDelta = maxXpDeltaForPush({ ...body, lessons }, server);
  const xp = Math.min(body.xp, server.xp + maxDelta);

  const graduatedClasses = await filterGraduatedClasses(
    db,
    { ...body, lessons, xp },
    server,
  );

  return { ...body, lessons, xp, graduatedClasses };
}

/** Exported for tests — caps a forged XP spike. */
export function clampIncomingXp(
  incomingXp: number,
  serverXp: number,
  body: ProgressPushBody,
  server: ServerProgressState,
): number {
  const maxDelta = maxXpDeltaForPush(body, server);
  return Math.min(incomingXp, serverXp + maxDelta);
}

export { MAX_XP_PER_PUSH, MAX_XP_PER_LESSON, NO_ACTIVITY_XP_CAP };
