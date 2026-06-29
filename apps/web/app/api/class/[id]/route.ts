import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Lessons within a class (id + meta) for the mobile class view. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db
    .select({ id: lessons.id, title: lessons.title, subtitle: lessons.subtitle, emoji: lessons.emoji, tag: lessons.tag, sortOrder: lessons.sortOrder })
    .from(lessons)
    .where(eq(lessons.classId, id));
  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  return NextResponse.json({ lessons: rows });
}
