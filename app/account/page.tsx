import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { db } from "@/db";
import { profiles, progress } from "@/db/schema";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { StudentIdCard } from "@/components/account/StudentIdCard";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = (await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1))[0];
  const prog = (await db.select().from(progress).where(eq(progress.userId, user.id)).limit(1))[0];
  const enrolled = profile ? new Date(profile.enrolledAt).toLocaleDateString() : "—";

  return (
    <div className="min-h-dvh bg-surface px-5 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <div className="flex items-center justify-between">
          <Logo />
          <form action={logoutAction}>
            <button className="rounded-pill border-2 border-hairline px-4 py-1.5 text-sm font-bold text-ink-700">
              Log out
            </button>
          </form>
        </div>

        <StudentIdCard
          name={user.name}
          email={user.email}
          studentNo={profile?.studentNo ?? "—"}
          rank={profile?.rankTitle ?? "Novice"}
          house={profile?.house ?? "Pawns"}
          enrolled={enrolled}
          avatar={profile?.avatarUrl ?? null}
        />

        {/* User-specific progress */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="XP" value={prog?.xp ?? 0} />
          <Stat label="Streak" value={prog?.streak ?? 0} />
          <Stat label="Classes" value={JSON.parse(prog?.graduatedClasses ?? "[]").length} />
        </div>

        <Link
          href="/library"
          className="btn-tactile flex items-center justify-center gap-2 rounded-pill bg-brand px-6 py-3 font-bold text-white [box-shadow:var(--shadow-button)]"
        >
          <Icon name="learn" size={20} className="text-white" /> Browse the lesson library
        </Link>
        {user.role === "admin" && (
          <Link
            href="/admin"
            className="btn-tactile flex items-center justify-center gap-2 rounded-pill border-2 border-hairline bg-surface-card px-6 py-3 font-bold text-ink"
          >
            <Icon name="gear" size={20} className="text-ink-700" /> Curriculum admin
          </Link>
        )}
        <Link href="/" className="text-center text-sm font-bold text-ink-500">
          Go to campus →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-hairline bg-surface-card p-4 text-center">
      <div className="text-2xl font-extrabold tabular-nums text-ink">{value}</div>
      <div className="text-xs font-semibold text-ink-500">{label}</div>
    </div>
  );
}
