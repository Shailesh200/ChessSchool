"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ContentIcon } from "@/components/ui/ContentIcon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { NavButton } from "@/components/ui/NavButton";
import { CampusSkeleton } from "@/components/home/CampusSkeleton";
import Link from "next/link";
import { useProgression } from "@/core/store/progression.store";
import { usePlan, ROUTINE_STEPS } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import { useMounted } from "@/core/hooks/useMounted";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";
import {
  dueLessonIds,
  isDailyPuzzleDone,
  needsPlacementTest,
  shouldRecommendPreschool,
} from "@chess-school/progression";
import type { Catalog } from "@/features/school/structure";

const CampusMap = dynamic(
  () => import("@/features/school/CampusMap").then((m) => ({ default: m.CampusMap })),
  { loading: () => <CampusSkeleton /> },
);

const ResumeCard = dynamic(
  () => import("@/features/school/ResumeCard").then((m) => ({ default: m.ResumeCard })),
  { loading: () => <div className="skeleton rounded-card h-24" /> },
);

const StreakMilestoneBanner = dynamic(
  () =>
    import("@/components/ceremony/StreakMilestoneBanner").then((m) => ({
      default: m.StreakMilestoneBanner,
    })),
  { ssr: false },
);

type DailyPuzzle = {
  day: string;
  lessonId: string | null;
  title: string | null;
  tag: string | null;
  emoji: string | null;
};

export function HomeClient({ catalog }: { catalog: Catalog }) {
  const todayXp = useProgression((s) => s.todayXp);
  const dailyGoal = useProgression((s) => s.dailyGoalXp);
  const streak = useProgression((s) => s.streak);
  const xp = useProgression((s) => s.xp);
  const placementDone = useProgression((s) => s.placementDone);
  const lessons = useProgression((s) => s.lessons);
  const authed = useSession((s) => s.authed);
  const rating = useProgression((s) => s.rating);
  const dailyPuzzleDay = useProgression((s) => s.dailyPuzzleDay);
  const homeworkDone = usePlan((s) => s.routineDone.length);
  const targetElo = useSettings((s) => s.targetElo);
  const graduatedClasses = useProgression((s) => s.graduatedClasses);
  const mounted = useMounted();
  const rehydrateReady = useRehydrateReady();
  const authedResolved = rehydrateReady ? authed : null;
  const showPlacement =
    authedResolved === true && mounted && needsPlacementTest({ placementDone, xp });
  const recommendPreschool =
    authedResolved === true &&
    mounted &&
    shouldRecommendPreschool(targetElo, { lessons, graduatedClasses });
  const dueIds = dueLessonIds(lessons);
  const [daily, setDaily] = useState<DailyPuzzle | null>(null);

  useEffect(() => {
    fetch("/api/daily-puzzle")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDaily(d))
      .catch(() => void 0);
  }, []);

  const dailyDone = daily ? isDailyPuzzleDone(daily.day, dailyPuzzleDay) : false;
  const firstDueTitle = dueIds[0] ? catalog.titles[dueIds[0]] : null;

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-8">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Image
            src="/mascots/cody-wave-v2.png"
            alt=""
            width={64}
            height={64}
            className="shrink-0"
            priority
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-ink truncate text-xl font-extrabold">
              {authedResolved === true && streak > 0
                ? `Day ${streak} at the academy`
                : "Welcome to ChessSchool!"}
            </h1>
            <p className="text-ink-500 text-sm font-semibold">
              {authedResolved === false
                ? "Enroll to the academy to track your progress."
                : "Graduate through classes. Become a stronger player."}
            </p>
          </div>
          {authedResolved === true && (
            <Link
              href="/dashboard"
              aria-label="Your rating"
              className="btn-tactile rounded-pill border-hairline bg-surface-card flex shrink-0 items-center gap-1.5 self-start border px-3 py-1.5 [box-shadow:var(--shadow-card)]"
            >
              <Icon name="target" size={16} className="text-brand" />
              <span className="text-ink text-sm font-extrabold">
                {mounted ? rating : 800}
              </span>
            </Link>
          )}
        </div>

        {authedResolved === true && rehydrateReady && (
          <StreakMilestoneBanner streak={streak} />
        )}

        {recommendPreschool && (
          <div className="rounded-card border-hairline bg-surface-sunken/80 border p-4">
            <p className="text-ink inline-flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="seedling" size={16} className="text-brand shrink-0" />
              Optional: Pre-School for complete beginners
            </p>
            <p className="text-ink-500 mt-1 text-xs font-semibold">
              Learn the board, pieces, and notation (d6, Nf3, Qd5) at your own pace —
              skip anytime if you already know the rules.
            </p>
            <NavButton href="/class/class-pre-board" size="sm" className="mt-3">
              Start Pre-School →
            </NavButton>
          </div>
        )}

        {showPlacement && (
          <div className="rounded-card border-brand-100 bg-brand-50 border p-4">
            <p className="text-ink inline-flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="target" size={16} className="text-brand shrink-0" />
              New here? Take a quick placement test
            </p>
            <p className="text-ink-500 mt-1 text-xs font-semibold">
              8 puzzles (~2 min) — we&apos;ll place you in Elementary, Middle, or High
              School.
            </p>
            <NavButton href="/placement" size="sm" className="mt-3">
              Start placement test →
            </NavButton>
          </div>
        )}

        <ResumeCard catalog={catalog} className="xl:hidden" />

        {authedResolved === true && dueIds.length > 0 && (
          <Link
            href={`/lesson/${dueIds[0]}`}
            className="btn-tactile rounded-card border-brand/30 bg-brand/10 flex items-center justify-between border px-4 py-3"
          >
            <span>
              <span className="text-ink flex items-center gap-1.5 text-sm font-extrabold">
                <Icon name="review" size={16} className="text-brand shrink-0" />
                Review due
              </span>
              <span className="text-ink-500 block text-xs font-semibold">
                {dueIds.length} lesson{dueIds.length === 1 ? "" : "s"} ready
                {firstDueTitle ? ` — start with “${firstDueTitle}”` : ""}
              </span>
            </span>
            <span className="text-brand text-sm font-bold">Start →</span>
          </Link>
        )}

        {authedResolved === true && daily?.lessonId && (
          <Link
            href={dailyDone ? "#" : `/lesson/${daily.lessonId}?daily=1`}
            className={`btn-tactile rounded-card flex items-center justify-between border px-4 py-3 ${
              dailyDone
                ? "border-success/40 bg-success/10"
                : "border-brand/30 bg-brand/5"
            }`}
            aria-disabled={dailyDone}
            onClick={dailyDone ? (e) => e.preventDefault() : undefined}
          >
            <span>
              <span className="text-ink flex items-center gap-1.5 text-sm font-extrabold">
                {dailyDone ? (
                  <>
                    <Icon name="check" size={16} className="text-success shrink-0" />
                    Daily puzzle done
                  </>
                ) : (
                  <>
                    <ContentIcon
                      emoji={daily.emoji ?? undefined}
                      name="puzzle"
                      size={16}
                      variant="inline"
                      tone="brand"
                    />
                    Daily puzzle
                  </>
                )}
              </span>
              <span className="text-ink-500 block text-xs font-semibold">
                {dailyDone
                  ? "Come back tomorrow for a fresh position."
                  : (daily.title ?? "One rated puzzle for everyone today")}
              </span>
            </span>
            {!dailyDone && <span className="text-brand text-sm font-bold">Play →</span>}
          </Link>
        )}

        {/* Today's homework prompt (logged-in) */}
        {authedResolved === true &&
          (homeworkDone < ROUTINE_STEPS.length ? (
            <Link
              href="/plan"
              className="btn-tactile rounded-card border-gold/40 bg-gold/10 flex items-center justify-between border px-4 py-3"
            >
              <span>
                <span className="text-ink flex items-center gap-1.5 text-sm font-extrabold">
                  <Icon name="journal" size={16} className="text-brand shrink-0" />
                  Today&apos;s homework
                </span>
                <span className="text-ink-500 block text-xs font-semibold">
                  {homeworkDone}/{ROUTINE_STEPS.length} done — finish it to keep your
                  streak
                </span>
              </span>
              <span className="text-brand text-sm font-bold">Open →</span>
            </Link>
          ) : (
            <Link
              href="/plan"
              className="btn-tactile rounded-card border-success/40 bg-success/10 flex items-center justify-between border px-4 py-3"
            >
              <span>
                <span className="text-ink flex items-center gap-1.5 text-sm font-extrabold">
                  <Icon name="check" size={16} className="text-success shrink-0" />
                  Homework done for today!
                </span>
                <span className="text-ink-500 block text-xs font-semibold">
                  Nice work — come back tomorrow for a fresh set.
                </span>
              </span>
              <span className="text-brand text-sm font-bold">Review →</span>
            </Link>
          ))}

        <Card className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-ink text-sm font-extrabold">Daily goal</span>
              <span className="text-ink-500 text-xs font-bold">
                {Math.min(todayXp, dailyGoal)}/{dailyGoal} XP
              </span>
            </div>
            <ProgressBar
              className="mt-2"
              tone="gold"
              value={todayXp}
              max={dailyGoal}
              label="Daily goal progress"
            />
          </div>
        </Card>

        {rehydrateReady ? <CampusMap catalog={catalog} /> : <CampusSkeleton />}
      </div>

      <aside className="hidden xl:sticky xl:top-6 xl:block">
        <ResumeCard catalog={catalog} />
      </aside>
    </div>
  );
}
