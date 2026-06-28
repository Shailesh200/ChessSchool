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

export async function deleteLesson(id: string): Promise<void> {
  const guard = await requireAdmin();
  if ("error" in guard) return;
  await db.delete(lessons).where(eq(lessons.id, id));
  refresh();
}
