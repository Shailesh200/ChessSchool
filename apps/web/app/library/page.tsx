import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { BackButton } from "@/components/ui/BackButton";
import { MyCompletedLibrary } from "@/components/library/MyCompletedLibrary";
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

  const countByClass = new Map<string, number>();
  for (const m of meta) {
    countByClass.set(m.classId, (countByClass.get(m.classId) ?? 0) + 1);
  }
  const total = meta.length;

  // Regular students see only the lessons they've completed.
  if (!isAdmin) {
    const classNameById = new Map(cls.map((c) => [c.id, c.title]));
    const libLessons = meta.map((m) => ({
      id: m.id,
      title: m.title,
      emoji: m.emoji,
      className: classNameById.get(m.classId) ?? "Lessons",
    }));
    return (
      <div className="bg-surface min-h-dvh px-5 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <BackButton />
          <MyCompletedLibrary lessons={libLessons} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-dvh px-5 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <BackButton />
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href={user ? "/account" : "/login"}
            className="rounded-pill border-hairline text-ink-700 border-2 px-4 py-1.5 text-sm font-bold"
          >
            {user ? user.name : "Log in"}
          </Link>
        </div>

        <div>
          <h1 className="text-ink text-2xl font-extrabold">Chess Lesson Library</h1>
          <p className="text-ink-600 mt-2 text-sm leading-relaxed font-semibold">
            Browse every free chess lesson at ChessSchool — tactics puzzles, opening
            theory, endgames, and beginner classes. {total.toLocaleString()} interactive
            lessons across {cls.length} classes.
            {user
              ? ` Welcome back, ${user.name}!`
              : " Enroll free to track your progress."}
          </p>
        </div>

        {sems.map((sem) => (
          <section key={sem.id}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="rounded-pill shrink-0 px-3 py-1 text-xs font-extrabold text-white"
                style={{ backgroundColor: sem.color }}
              >
                {sem.title}
              </span>
              <span className="text-ink-500 truncate text-xs font-semibold">
                {sem.blurb}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {cls
                .filter((c) => c.semesterId === sem.id)
                .map((c) => (
                  <Link
                    key={c.id}
                    href={`/class/${c.id}`}
                    className="btn-tactile rounded-card border-hairline bg-surface-card flex items-center gap-3 border p-3 [box-shadow:var(--shadow-card)]"
                  >
                    <span className="text-2xl">{c.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-sm font-extrabold">
                        {c.title}
                      </p>
                      <p className="text-ink-500 truncate text-xs font-semibold">
                        {countByClass.get(c.id) ?? 0} lessons
                      </p>
                    </div>
                    <Icon name="arrowRight" size={18} className="text-brand" />
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
