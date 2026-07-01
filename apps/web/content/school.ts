/**
 * ChessSchool structure — types + curated constants.
 *
 * The DATA lives in `./data/school.mjs` (plain JS) so the Node seeder can import
 * it too; this module adds the TypeScript types. Logic over this data lives in
 * `features/school/structure.ts`. At runtime the app reads the catalog from the
 * DB (see `features/school/catalog.server.ts`); these constants are the seed
 * source + a fallback.
 */
import { STAGES as RAW_STAGES, SEMESTERS as RAW_SEMESTERS } from "./data/school.mjs";

export interface ContentUnit {
  id: string;
  title: string;
  lessonIds: string[];
}

export interface SchoolClass {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  /** flat lesson order (source of truth); `units` is optional display grouping */
  lessonIds: string[];
  examId?: string;
  difficulty?: number; // 1..5
  units?: ContentUnit[];
}

export interface Semester {
  id: string;
  title: string;
  blurb: string;
  color: string;
  stage: string; // Stage id
  classes: SchoolClass[];
}

export interface Stage {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  status: "open" | "upcoming";
  /** Optional schools (e.g. Pre-School) never gate later schools. */
  optional?: boolean;
}

export const STAGES: Stage[] = RAW_STAGES as Stage[];
export const SEMESTERS: Semester[] = RAW_SEMESTERS as Semester[];
