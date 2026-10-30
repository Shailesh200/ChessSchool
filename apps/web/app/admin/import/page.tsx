import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { AdminImportScreen } from "@/features/admin/AdminImportScreen";

export const metadata = { title: "Puzzle import" };
export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/import");
  if (user.role !== "admin") redirect("/admin");

  const cls = await db.select().from(classes).orderBy(asc(classes.sortOrder));
  return <AdminImportScreen classes={cls.map((c) => ({ id: c.id, title: c.title }))} />;
}
