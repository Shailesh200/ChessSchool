import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { profiles, progress } from "@/db/schema";
import { AccountView } from "@/components/account/AccountView";
import { rankForClasses } from "@/lib/rank";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = (
    await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1)
  )[0];
  const prog = (
    await db.select().from(progress).where(eq(progress.userId, user.id)).limit(1)
  )[0];
  const enrolled = profile ? new Date(profile.enrolledAt).toLocaleDateString() : "—";
  const graduated = JSON.parse(prog?.graduatedClasses ?? "[]") as string[];

  return (
    <AccountView
      name={user.name}
      email={user.email}
      role={user.role}
      studentNo={profile?.studentNo ?? "—"}
      rank={rankForClasses(graduated.length)}
      house={profile?.house ?? "Pawns"}
      enrolled={enrolled}
      avatar={profile?.avatarUrl ?? null}
      xp={prog?.xp ?? 0}
      streak={prog?.streak ?? 0}
      classCount={graduated.length}
    />
  );
}
