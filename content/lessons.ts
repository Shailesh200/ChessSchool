/**
 * ChessSchool lesson content — types + curated constants.
 *
 * The DATA lives in `./data/lessons.mjs` (plain JS) so the Node seeder can
 * import it too; this module adds the TypeScript types + getLesson helper.
 */
import type { Lesson } from "@/features/lessons/types";
import { LESSONS as RAW_LESSONS } from "./data/lessons.mjs";

export const LESSONS: Lesson[] = RAW_LESSONS as Lesson[];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
