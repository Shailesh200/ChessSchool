import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users, semesters, classes, lessons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Logo } from "@/components/ui/Logo";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <Logo />
        <h1 className="text-2xl font-extrabold text-ink">Admin access required</h1>
        <p className="max-w-sm text-sm font-semibold text-ink-500">
          You&apos;re signed in as <b>{user.name}</b> (role: {user.role}). To become an admin, set
          your user&apos;s <code>role</code> to <code>admin</code> — run <code>pnpm db:studio</code>,
          open the <code>users</code> table, and change it.
        </p>
        <Link href="/" className="font-bold text-brand">
          ← Back to campus
        </Link>
      </div>
    );
  }

  const sems = await db.select().from(semesters).orderBy(asc(semesters.sortOrder));
  const cls = await db.select().from(classes).orderBy(asc(classes.sortOrder));
  const allLessons = await db.select({ id: lessons.id, classId: lessons.classId, title: lessons.title, tag: lessons.tag }).from(lessons);
  const userCount = (await db.select({ id: users.id }).from(users)).length;
  const adminLessons = allLessons.filter((l) => l.tag === "admin");

  return (
    <AdminPanel
      adminName={user.name}
      stats={{
        semesters: sems.length,
        classes: cls.length,
        lessons: allLessons.length,
        users: userCount,
      }}
      semesters={sems.map((s) => ({ id: s.id, title: s.title }))}
      classes={cls.map((c) => ({ id: c.id, title: c.title }))}
      recent={adminLessons.slice(-12).reverse()}
    />
  );
}
