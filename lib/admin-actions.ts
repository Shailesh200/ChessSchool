"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Chess } from "chess.js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in." };
  if (user.role !== "admin") return { error: "Admin access required." };
  return { ok: true };
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/library");
}

export async function createSemester(
  _prev: { error?: string; ok?: boolean } | undefined,
  fd: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };
  const count = (await db.select().from(semesters)).length;
  await db.insert(semesters).values({
    id: `sem-admin-${randomUUID().slice(0, 8)}`,
    title,
    blurb: String(fd.get("blurb") ?? ""),
    color: String(fd.get("color") ?? "#5b5bd6"),
    stage: String(fd.get("stage") ?? "elementary"),
    sortOrder: 100 + count,
  });
  refresh();
  return { ok: true };
}

export async function createClass(
  _prev: { error?: string; ok?: boolean } | undefined,
  fd: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };
  const semesterId = String(fd.get("semesterId") ?? "");
  const title = String(fd.get("title") ?? "").trim();
  if (!semesterId || !title) return { error: "Semester and title are required." };
  const count = (await db.select().from(classes)).length;
  await db.insert(classes).values({
    id: `class-admin-${randomUUID().slice(0, 8)}`,
    semesterId,
    title,
    emoji: String(fd.get("emoji") ?? "♟️"),
    blurb: String(fd.get("blurb") ?? ""),
    difficulty: Number(fd.get("difficulty") ?? 1),
    sortOrder: 1000 + count,
  });
  refresh();
  return { ok: true };
}

export async function createLesson(
  _prev: { error?: string; ok?: boolean } | undefined,
  fd: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };
  const classId = String(fd.get("classId") ?? "");
  const title = String(fd.get("title") ?? "").trim();
  const coach = String(fd.get("coach") ?? "").trim();
  const fen = String(fd.get("fen") ?? "").trim();
  const solution = String(fd.get("solution") ?? "").trim(); // "e2:e4"
  if (!classId || !title || !coach || !fen || !solution)
    return { error: "All fields are required." };

  // Validate the position + move with chess.js — no broken lesson can be saved.
  const [from, to] = solution.split(":");
  if (!from || !to) return { error: "Solution must look like e2:e4." };
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return { error: "Invalid FEN." };
  }
  let moved;
  try {
    moved = game.move({ from, to, promotion: "q" });
  } catch {
    moved = null;
  }
  if (!moved) return { error: `${solution} is not a legal move in that position.` };

  const steps = [
    {
      id: "solve",
      kind: "move",
      coach,
      fen,
      solution: [`${from}:${to}`],
      highlight: [to],
      successText: "Correct!",
      failText: "Not quite — try again.",
      tag: "admin",
    },
  ];
  await db.insert(lessons).values({
    id: `lesson-admin-${randomUUID().slice(0, 8)}`,
    classId,
    title,
    subtitle: moved.san,
    emoji: "✍️",
    tag: "admin",
    xp: 15,
    isExam: 0,
    prerequisites: "[]",
    steps: JSON.stringify(steps),
    sortOrder: 0,
  });
  refresh();
  return { ok: true };
}

/** Normalize "e2:e4" / "e2e4" → {from,to}. */
function parseMove(sol: unknown): { from: string; to: string } | null {
  const s = String(sol ?? "").trim();
  const m = s.includes(":") ? s.split(":") : [s.slice(0, 2), s.slice(2, 4)];
  if (!m[0] || !m[1] || m[0].length !== 2 || m[1].length !== 2) return null;
  return { from: m[0], to: m[1] };
}

interface ImportLesson { title?: string; subtitle?: string; emoji?: string; tag?: string; xp?: number; steps?: { fen?: string; solution?: string; coach?: string }[] }
interface ImportClass { title?: string; emoji?: string; blurb?: string; difficulty?: number; lessons?: ImportLesson[] }
interface ImportDoc { semester?: { title?: string; blurb?: string; color?: string; stage?: string }; semesterId?: string; classes?: ImportClass[] }

/**
 * Bulk-import a semester / classes / lessons from a JSON document (#14).
 * Validates every FEN + move with chess.js *before* inserting anything.
 */
export async function importContent(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  fd: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const raw = String(fd.get("json") ?? "").trim();
  if (!raw) return { error: "Paste or upload a JSON file first." };
  let doc: ImportDoc;
  try {
    doc = JSON.parse(raw) as ImportDoc;
  } catch {
    return { error: "That isn't valid JSON." };
  }
  if (!Array.isArray(doc.classes) || doc.classes.length === 0)
    return { error: "JSON needs a non-empty \"classes\" array." };
  if (!doc.semester && !doc.semesterId)
    return { error: "Provide a \"semester\" object or an existing \"semesterId\"." };

  const semId = doc.semester ? `sem-imp-${randomUUID().slice(0, 8)}` : doc.semesterId!;
  if (!doc.semester) {
    const exists = (await db.select().from(semesters).where(eq(semesters.id, semId)).limit(1))[0];
    if (!exists) return { error: `Semester "${semId}" not found.` };
  }

  // Build + validate everything up front (atomic-ish: nothing inserts on error).
  const classRows: (typeof classes.$inferInsert)[] = [];
  const lessonRows: (typeof lessons.$inferInsert)[] = [];
  const baseClass = (await db.select().from(classes)).length;
  const baseSem = (await db.select().from(semesters)).length;

  for (let ci = 0; ci < doc.classes.length; ci++) {
    const c = doc.classes[ci]!;
    if (!c.title) return { error: "Each class needs a title." };
    const cid = `class-imp-${randomUUID().slice(0, 8)}`;
    classRows.push({
      id: cid,
      semesterId: semId,
      title: c.title,
      emoji: c.emoji ?? "♟️",
      blurb: c.blurb ?? "",
      difficulty: c.difficulty ?? 1,
      sortOrder: 1000 + baseClass + ci,
    });
    const ls = c.lessons ?? [];
    for (let li = 0; li < ls.length; li++) {
      const l = ls[li]!;
      if (!l.title) return { error: `A lesson in "${c.title}" is missing a title.` };
      const steps: unknown[] = [];
      for (const s of l.steps ?? []) {
        const mv = parseMove(s.solution);
        if (!mv) return { error: `Lesson "${l.title}": solution must look like e2:e4.` };
        try {
          const g = new Chess(String(s.fen));
          if (!g.move({ from: mv.from, to: mv.to, promotion: "q" })) throw new Error();
        } catch {
          return { error: `Lesson "${l.title}": "${s.solution}" is not legal in that position.` };
        }
        steps.push({
          id: `s${steps.length}`,
          kind: "move",
          coach: s.coach ?? "Find the best move.",
          fen: s.fen,
          solution: [`${mv.from}:${mv.to}`],
          highlight: [mv.to],
          successText: "Correct!",
          failText: "Not quite — try again.",
          tag: l.tag ?? "import",
        });
      }
      if (steps.length === 0) return { error: `Lesson "${l.title}" has no valid steps.` };
      lessonRows.push({
        id: `lesson-imp-${randomUUID().slice(0, 8)}`,
        classId: cid,
        title: l.title,
        subtitle: l.subtitle ?? "",
        emoji: l.emoji ?? "♟️",
        tag: l.tag ?? "import",
        xp: l.xp ?? 20,
        isExam: 0,
        prerequisites: "[]",
        steps: JSON.stringify(steps),
        sortOrder: li,
      });
    }
  }

  if (doc.semester) {
    await db.insert(semesters).values({
      id: semId,
      title: doc.semester.title ?? "Imported semester",
      blurb: doc.semester.blurb ?? "",
      color: doc.semester.color ?? "#5b5bd6",
      stage: doc.semester.stage ?? "middle",
      sortOrder: 100 + baseSem,
    });
  }
  for (const c of classRows) await db.insert(classes).values(c);
  for (const l of lessonRows) await db.insert(lessons).values(l);
  refresh();
  return { ok: true, message: `Imported ${classRows.length} classes and ${lessonRows.length} lessons.` };
}

export async function deleteLesson(id: string): Promise<void> {
  const guard = await requireAdmin();
  if ("error" in guard) return;
  await db.delete(lessons).where(eq(lessons.id, id));
  refresh();
}
