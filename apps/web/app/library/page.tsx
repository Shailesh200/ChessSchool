import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { LibraryBrowse } from "@/components/library/LibraryBrowse";
import { LibraryStudentView } from "@/components/library/LibraryStudentView";
import { socialMeta } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Chess Lesson Library — Browse All Classes",
  description:
    "Browse every chess lesson and class at ChessSchool — tactics, openings, endgames, and puzzles. Free online chess school library.",
  ...socialMeta({
    title: "Chess Lesson Library",
    description:
      "Browse all chess classes, puzzles, and lessons — free online chess school.",
    path: "/library",
    kind: "home",
    badge: "Chess Library",
    emoji: "📖",
  }),
};
export const revalidate = 3600;

export default async function LibraryPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const sems = await db.select().from(semesters).orderBy(asc(semesters.sortOrder));
  const cls = await db.select().from(classes).orderBy(asc(classes.sortOrder));
  const meta = await db
    .select({
      id: lessons.id,
      classId: lessons.classId,
      title: lessons.title,
      emoji: lessons.emoji,
      sortOrder: lessons.sortOrder,
    })
    .from(lessons)
    .orderBy(asc(lessons.sortOrder));

  const countByClass: Record<string, number> = {};
  for (const m of meta) {
    countByClass[m.classId] = (countByClass[m.classId] ?? 0) + 1;
  }
  const total = meta.length;

  if (!isAdmin) {
    const classNameById = new Map(cls.map((c) => [c.id, c.title]));
    const libLessons = meta.map((m) => ({
      id: m.id,
      title: m.title,
      emoji: m.emoji,
      className: classNameById.get(m.classId) ?? "Lessons",
    }));
    return <LibraryStudentView lessons={libLessons} />;
  }

  return (
    <LibraryBrowse
      semesters={sems.map((s) => ({
        id: s.id,
        title: s.title,
        blurb: s.blurb,
        color: s.color,
      }))}
      classes={cls.map((c) => ({
        id: c.id,
        semesterId: c.semesterId,
        title: c.title,
        emoji: c.emoji,
      }))}
      countByClass={countByClass}
      total={total}
      userName={user?.name ?? null}
    />
  );
}
