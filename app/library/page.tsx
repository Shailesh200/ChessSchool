import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";

export const metadata = { title: "Lesson library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/"); // library is an admin tool now
  const sems = await db.select().from(semesters).orderBy(asc(semesters.sortOrder));
  const cls = await db.select().from(classes).orderBy(asc(classes.sortOrder));
  const meta = await db
    .select({ id: lessons.id, classId: lessons.classId, sortOrder: lessons.sortOrder })
    .from(lessons)
    .orderBy(asc(lessons.sortOrder));

  const countByClass = new Map<string, number>();
  const firstByClass = new Map<string, string>();
  for (const m of meta) {
    countByClass.set(m.classId, (countByClass.get(m.classId) ?? 0) + 1);
    if (!firstByClass.has(m.classId)) firstByClass.set(m.classId, m.id);
  }
  const total = meta.length;

  return (
    <div className="min-h-dvh bg-surface px-5 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href={user ? "/account" : "/login"}
            className="rounded-pill border-2 border-hairline px-4 py-1.5 text-sm font-bold text-ink-700"
          >
            {user ? user.name : "Log in"}
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-ink">Lesson Library</h1>
          <p className="text-sm font-semibold text-ink-500">
            {total.toLocaleString()} lessons · {cls.length} classes · {sems.length} semesters
            {user ? ` · welcome, ${user.name}!` : ""}
          </p>
        </div>

        {sems.map((sem) => (
          <section key={sem.id}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="shrink-0 rounded-pill px-3 py-1 text-xs font-extrabold text-white"
                style={{ backgroundColor: sem.color }}
              >
                {sem.title}
              </span>
              <span className="truncate text-xs font-semibold text-ink-500">{sem.blurb}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {cls
                .filter((c) => c.semesterId === sem.id)
                .map((c) => {
                  const first = firstByClass.get(c.id);
                  return (
                    <Link
                      key={c.id}
                      href={first ? `/library/lesson/${first}` : "#"}
                      className="btn-tactile flex items-center gap-3 rounded-card border border-hairline bg-surface-card p-3 [box-shadow:var(--shadow-card)]"
                    >
                      <span className="text-2xl">{c.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-ink">{c.title}</p>
                        <p className="truncate text-xs font-semibold text-ink-500">
                          {countByClass.get(c.id) ?? 0} lessons
                        </p>
                      </div>
                      <Icon name="arrowRight" size={18} className="text-brand" />
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
