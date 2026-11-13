import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { emptyProgress, sanitizeProgress, type PathStep, type Progress } from "@chessschool/design";
import { applyCourse, loadPath } from "../src/course";
import type { CourseDoc } from "../src/course-check";
import { openDb } from "../src/db";
import { applyPuzzlePack, parsePuzzlePack } from "../src/puzzles";
import { profiles, progress, users } from "../src/schema";
import { hashPassword, newId } from "../src/security";

export const QA_MEMBER_EMAIL = "student@example.com";
export const QA_GUEST_EMAIL = "guest@example.com";
export const QA_PASSWORD = "pawnpawn";

function withLessons(ids: string[], path: readonly PathStep[]): Progress {
  const value = emptyProgress();
  for (const id of ids) value.completed[id] = "2026-11-03";
  value.xp = 100_000;
  return sanitizeProgress(value, path);
}

/** Inserts the local QA accounts when they are not already in this file database. */
export async function seedQa(url: string): Promise<void> {
  if (!url.startsWith("file:")) throw new Error("qa seed refuses a non-local database");
  const db = await openDb(url);
  const course = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../data/course.json"), "utf8")) as CourseDoc;
  await applyCourse(db, course);
  const passwordHash = await hashPassword(QA_PASSWORD);
  await ensure(db, { email: QA_GUEST_EMAIL, name: "Guest", kind: "guest", passwordHash, lessons: ["meet"] });
  await ensure(db, { email: QA_MEMBER_EMAIL, name: "Student", kind: "member", passwordHash, lessons: ["meet", "board"] });
  const fixture = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/puzzles-stub.json");
  const parsed = parsePuzzlePack(readFileSync(fixture, "utf8"));
  if (!parsed.ok) throw new Error(parsed.errors.join("; "));
  await applyPuzzlePack(db, parsed.pack);
  console.log("seeded guest@example.com (guest) and student@example.com (member)");
  console.log(`seeded puzzles ${parsed.pack.version}`);
}

async function ensure(
  db: Awaited<ReturnType<typeof openDb>>,
  row: { email: string; name: string; kind: "guest" | "member"; passwordHash: string; lessons: string[] },
) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, row.email) });
  if (existing) return;
  const id = newId();
  const now = Date.now();
  await db.insert(users).values({
    id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    googleSub: null,
    guestId: null,
    kind: row.kind,
    createdAt: now,
  });
  await db.insert(profiles).values({ userId: id, who: null, dailyMinutes: 10, appearance: "system", sound: true, avatar: "cody", flair: null });
  await db.insert(progress).values({ userId: id, data: JSON.stringify(withLessons(row.lessons, await loadPath(db))), updatedAt: now });
}
