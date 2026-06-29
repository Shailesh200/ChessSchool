"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useMounted } from "@/core/hooks/useMounted";
import { useProgression, isoDay } from "@/core/store/progression.store";
import {
  usePlan,
  planGoalXp,
  PLAN_SPECS,
  ROUTINE_STEPS,
  type PlanTier,
  type Schedule,
} from "@/core/store/plan.store";
import { currentLocation, type Catalog } from "@/features/school/structure";
import { useMatch } from "@/core/store/match.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

// Each homework routine draws from a pool of themes; rotates daily.
const ROUTINE_POOLS: Record<string, string[]> = {
  warmup: ["capture", "piece", "check", "basics"],
  practice: ["fork", "pin", "skewer", "discovered", "tactics"],
  review: ["checkmate", "mate", "endgame"],
  reflection: ["opening", "promotion", "endgame", "strategy"],
};

export function PlanClient({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const mounted = useMounted();
  const plan = usePlan();
  const records = useProgression((s) => s.lessons);
  const graduated = useProgression((s) => s.graduatedClasses);
  const rating = useProgression((s) => s.rating);
  const startMatch = useMatch((s) => s.start);
  const setDailyGoalXp = useProgression((s) => s.setDailyGoalXp);
  const lastActiveDay = useProgression((s) => s.lastActiveDay);
  const todayXp = useProgression((s) => s.todayXp);
  const dailyGoalXp = useProgression((s) => s.dailyGoalXp);
  const streak = useProgression((s) => s.streak);
  const [lessonsByTag, setLessonsByTag] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch("/api/curriculum-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLessonsByTag(d?.lessonsByTag ?? {}))
      .catch(() => void 0);
  }, []);

  // Keep the daily XP goal in sync with the chosen plan.
  useEffect(() => {
    if (!mounted) return;
    plan.ensureDay(isoDay());
    setDailyGoalXp(planGoalXp(plan));
  }, [mounted, plan.tier, plan.customGoalXp]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) {
    return (
      <AppShell>
        <div className="skeleton h-96 rounded-card" />
      </AppShell>
    );
  }

  const daysAway = lastActiveDay ? daysBetween(lastActiveDay, isoDay()) : 0;
  const routineDone = plan.routineDone.length;
  // The student's actual next lesson — homework points straight at it.
  const loc = currentLocation(records, graduated, catalog.semesters, catalog.titles);
  const nextLessonId = loc.complete ? null : loc.lessonId;

  // A different lesson each day per routine type (rotates by day number).
  const dayIndex = Math.floor(Date.parse(isoDay() + "T00:00:00Z") / 86400000);
  const pickLesson = (stepId: string): string | null => {
    for (const tag of ROUTINE_POOLS[stepId] ?? []) {
      const ids = lessonsByTag[tag];
      if (ids?.length) return ids[dayIndex % ids.length]!;
    }
    const all = Object.values(lessonsByTag).flat();
    return all.length ? all[dayIndex % all.length]! : null;
  };

  function startAdaptiveMatch() {
    haptics.fire("success");
    audio.play("unlock");
    startMatch("bot", rating, 0); // adaptive: bot plays at your current rating
    router.push("/play");
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <BackButton />
        <h1 className="text-xl font-extrabold text-ink">Homework</h1>

        {/* Today's progress toward the goal */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-ink">🎯 Today&apos;s goal</span>
            <span className="text-xs font-bold text-ink-500">
              {Math.min(todayXp, dailyGoalXp)}/{dailyGoalXp} XP
            </span>
          </div>
          <ProgressBar className="mt-2" tone="gold" value={todayXp} max={dailyGoalXp} label="Daily goal progress" />
          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-ink-700">
            <span className="rounded-pill bg-accent/10 px-2 py-1 text-accent-600">🔥 {streak}-day streak</span>
            <span className="rounded-pill bg-surface-sunken px-2 py-1">
              {todayXp >= dailyGoalXp ? "Goal reached — well done! 🎉" : `${dailyGoalXp - todayXp} XP to go`}
            </span>
          </div>
        </Card>

        {daysAway >= 2 && (
          <Card className="border-accent-400 bg-accent/5">
            <p className="text-sm font-extrabold text-accent-600">👋 Welcome back!</p>
            <p className="mt-1 text-xs font-semibold text-ink-700">
              You were away {daysAway} days — no problem, no penalties. We&apos;ve kept your
              progress. Ease back in with one short lesson today.
            </p>
            <Link
              href={nextLessonId ? `/lesson/${nextLessonId}` : "/"}
              className="mt-2 inline-block text-sm font-bold text-accent-600"
            >
              Resume learning →
            </Link>
          </Card>
        )}

        {/* Plan tiers */}
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">Choose your pace</h2>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PLAN_SPECS) as PlanTier[]).map((tier) => {
              const spec = PLAN_SPECS[tier];
              const active = plan.tier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => {
                    plan.setTier(tier);
                    haptics.fire("select");
                    audio.play("select");
                  }}
                  className={`btn-tactile rounded-card border-2 p-3 text-left ${
                    active ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
                  }`}
                >
                  <div className="text-xl">{spec.emoji}</div>
                  <div className="mt-1 text-sm font-extrabold text-ink">{spec.label}</div>
                  <div className="text-[11px] font-semibold text-ink-500">{spec.minutes}/day</div>
                </button>
              );
            })}
          </div>
          {plan.tier === "custom" && (
            <Card className="mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink">Daily XP goal</span>
                <span className="text-sm font-extrabold text-brand">{plan.customGoalXp} XP</span>
              </div>
              <input
                type="range" min={10} max={200} step={10} value={plan.customGoalXp}
                onChange={(e) => plan.setCustomGoal(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--brand-500)]"
                aria-label="Custom daily XP goal"
              />
            </Card>
          )}
          <p className="mt-2 text-xs font-semibold text-ink-500">
            {PLAN_SPECS[plan.tier].blurb} · Goal: {planGoalXp(plan)} XP/day ·{" "}
            {PLAN_SPECS[plan.tier].lessonsPerDay} lessons
          </p>
        </section>

        {/* Schedule */}
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">When do you study?</h2>
          <div className="flex gap-2">
            {(["daily", "weekdays", "weekends"] as Schedule[]).map((s) => (
              <button
                key={s}
                onClick={() => { plan.setSchedule(s); haptics.fire("select"); }}
                className={`flex-1 rounded-pill py-2 text-sm font-bold capitalize ${
                  plan.schedule === s ? "bg-brand text-white" : "bg-surface-sunken text-ink-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Today's homework */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink">Today&apos;s homework</h2>
            <span className="text-xs font-bold text-ink-500">
              {routineDone}/{ROUTINE_STEPS.length} · 🔥 {plan.homeworkStreak}d
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {ROUTINE_STEPS.map((step) => {
              const done = plan.routineDone.includes(step.id);
              const isMatch = step.id === "match";
              // The "lesson" step is your next lesson; other lesson steps rotate daily by type.
              const lessonId = step.id === "lesson" ? nextLessonId : pickLesson(step.id);
              const href = lessonId ? `/lesson/${lessonId}?hw=${step.id}` : step.href;
              const label =
                step.id === "lesson" && nextLessonId ? `Lesson: ${loc.lessonTitle}` : step.label;
              return (
                <Card key={step.id} className="flex items-center gap-3 p-3">
                  {/* Display-only — checks itself when you complete the activity. */}
                  <span
                    aria-label={done ? `${step.label} done` : `${step.label} not done`}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                      done ? "border-success bg-success text-white" : "border-hairline text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="text-lg">{step.emoji}</span>
                  <span className={`min-w-0 flex-1 truncate text-sm font-bold ${done ? "text-ink-300 line-through" : "text-ink"}`}>
                    {label}
                  </span>
                  {isMatch ? (
                    <button onClick={startAdaptiveMatch} className="shrink-0 text-sm font-bold text-brand">
                      {done ? "Again" : `Play (${rating}) →`}
                    </button>
                  ) : (
                    <Link href={href} className="shrink-0 text-sm font-bold text-brand">
                      {done ? "Again" : "Go →"}
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
          {routineDone === ROUTINE_STEPS.length && (
            <p className="mt-2 text-center text-xs font-extrabold text-success">
              🎉 Homework complete — {plan.homeworkStreak}-day streak!
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}
