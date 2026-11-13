import { readFileSync } from "node:fs";
import { DEFAULT_COURSE_FILE } from "../scripts/seed-course";
import { applyCourse } from "../src/course";
import { checkCourse, type CourseDoc } from "../src/course-check";
import { openDb, type Db } from "../src/db";

/** data/course.json, validated once per test file. */
export const COURSE: CourseDoc = (() => {
  const checked = checkCourse(JSON.parse(readFileSync(DEFAULT_COURSE_FILE, "utf8")));
  if (!checked.ok) throw new Error(checked.errors.join("\n"));
  return checked.doc;
})();

/** An in-memory database with the course seeded, like production after `seed:course --apply`. */
export async function seededDb(url = ":memory:"): Promise<Db> {
  const db = await openDb(url);
  await applyCourse(db, COURSE);
  return db;
}
