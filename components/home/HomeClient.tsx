"use client";

import { AppShell } from "@/components/layout/AppShell";
import { CampusMap } from "@/features/school/CampusMap";
import { ResumeCard } from "@/features/school/ResumeCard";
import { Mascot } from "@/components/ui/Mascot";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { NavButton } from "@/components/ui/NavButton";
import Link from "next/link";
import { useProgression } from "@/core/store/progression.store";
import { usePlan, ROUTINE_STEPS } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";
import { useMounted } from "@/core/hooks/useMounted";
import type { Catalog } from "@/features/school/structure";

export function HomeClient({ catalog }: { catalog: Catalog }) {
  const todayXp = useProgression((s) => s.todayXp);
  const dailyGoal = useProgression((s) => s.dailyGoalXp);
  const streak = useProgression((s) => s.streak);
  const lessons = useProgression((s) => s.lessons);
  const graduated = useProgression((s) => s.graduatedClasses);
  const authed = useSession((s) => s.authed);
  const rating = useProgression((s) => s.rating);
  const homeworkDone = usePlan((s) => s.routineDone.length);
  const mounted = useMounted();
  const isNew = mounted && Object.keys(lessons).length === 0 && graduated.length === 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Mascot expression="wave" size={64} float={false} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold text-ink">
              {authed === true && streak > 0 ? `Day ${streak} at the academy` : "Welcome to ChessSchool!"}
            </h1>
            <p className="text-sm font-semibold text-ink-500">
              {authed === true
                ? "Graduate through classes. Become a stronger player."
                : "Enroll to the academy to track your progress."}
            </p>
          </div>
          {authed === true && (
            <Link
              href="/dashboard"
              aria-label="Your rating"
              className="btn-tactile flex shrink-0 items-center gap-1.5 self-start rounded-pill border border-hairline bg-surface-card px-3 py-1.5 [box-shadow:var(--shadow-card)]"
            >
              <Icon name="target" size={16} className="text-brand" />
              <span className="text-sm font-extrabold text-ink">{mounted ? rating : 800}</span>
            </Link>
          )}
        </div>

        {isNew && (
          <div className="rounded-card border border-brand-100 bg-brand-50 p-4">
            <p className="text-sm font-extrabold text-ink">🎯 New here? Take a quick placement test</p>
            <p className="mt-1 text-xs font-semibold text-ink-500">
              8 puzzles (~2 min) — we&apos;ll place you in Elementary, Middle, or High School.
            </p>
            <NavButton href="/placement" size="sm" className="mt-3">
              Start placement test →
            </NavButton>
          </div>
        )}

        <ResumeCard catalog={catalog} />

        {/* Today's homework prompt (logged-in) */}
        {authed === true &&
          (homeworkDone < ROUTINE_STEPS.length ? (
            <Link
              href="/plan"
              className="btn-tactile flex items-center justify-between rounded-card border border-gold/40 bg-gold/10 px-4 py-3"
            >
              <span>
                <span className="block text-sm font-extrabold text-ink">📋 Today&apos;s homework</span>
                <span className="block text-xs font-semibold text-ink-500">
                  {homeworkDone}/{ROUTINE_STEPS.length} done — finish it to keep your streak
                </span>
              </span>
              <span className="text-sm font-bold text-brand">Open →</span>
            </Link>
          ) : (
            <Link
              href="/plan"
              className="btn-tactile flex items-center justify-between rounded-card border border-success/40 bg-success/10 px-4 py-3"
            >
              <span>
                <span className="block text-sm font-extrabold text-ink">✅ Homework done for today!</span>
                <span className="block text-xs font-semibold text-ink-500">
                  Nice work — come back tomorrow for a fresh set.
                </span>
              </span>
              <span className="text-sm font-bold text-brand">Review →</span>
            </Link>
          ))}

        <Card className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-ink">Daily goal</span>
              <span className="text-xs font-bold text-ink-500">
                {Math.min(todayXp, dailyGoal)}/{dailyGoal} XP
              </span>
            </div>
            <ProgressBar className="mt-2" tone="gold" value={todayXp} max={dailyGoal} label="Daily goal progress" />
          </div>
        </Card>

        <CampusMap catalog={catalog} />
      </div>
    </AppShell>
  );
}
