"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { LogoutButton } from "@/components/account/LogoutButton";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { BackButton } from "@/components/ui/BackButton";
import { StudentIdCard } from "@/components/account/StudentIdCard";
import { RatingBadge } from "@/components/account/RatingBadge";
import { Icon } from "@/components/ui/Icon";
import { NavButton } from "@/components/ui/NavButton";

export function AccountView({
  name,
  email,
  role,
  studentNo,
  rank,
  house,
  enrolled,
  avatar,
  xp,
  streak,
  classCount,
}: {
  name: string;
  email: string;
  role: string;
  studentNo: string;
  rank: string;
  house: string;
  enrolled: string;
  avatar: string | null;
  xp: number;
  streak: number;
  classCount: number;
}) {
  const isAdmin = role === "admin";

  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:gap-6">
        <BackButton />
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-ink text-xl font-extrabold lg:text-2xl">My account</h1>
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8">
          <div className="flex max-w-md flex-col gap-5 lg:max-w-none">
            <StudentIdCard
              name={name}
              email={email}
              studentNo={studentNo}
              rank={rank}
              house={house}
              enrolled={enrolled}
              avatar={avatar}
            />

            {isAdmin && (
              <>
                <NavButton href="/library" block>
                  <Icon name="learn" size={20} className="text-white" /> Browse the
                  lesson library
                </NavButton>
                <NavButton href="/admin" variant="outline" block>
                  <Icon name="gear" size={20} className="text-ink-700" /> Curriculum
                  admin
                </NavButton>
              </>
            )}

            <Link
              href="/academy"
              className="text-ink-500 text-center text-sm font-bold lg:text-left"
            >
              Go to campus →
            </Link>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
            <div className="hidden items-center justify-between lg:flex">
              <p className="text-ink-500 text-xs font-semibold">Signed in as {email}</p>
              <LogoutButton />
            </div>

            <RatingBadge />

            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <Stat label="XP" value={xp} />
              <Stat label="Streak" value={streak} />
              <Stat label="Classes" value={classCount} />
            </div>

            <div className="border-hairline flex flex-col gap-3 border-t pt-6">
              <p className="text-ink-500 text-center text-xs font-semibold lg:text-left">
                <Link
                  href="/privacy"
                  className="text-brand-500 font-bold hover:underline"
                >
                  Privacy policy
                </Link>
              </p>
              <DeleteAccountButton />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border-hairline bg-surface-card border p-4 text-center">
      <div className="text-ink text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-ink-500 text-xs font-semibold">{label}</div>
    </div>
  );
}
