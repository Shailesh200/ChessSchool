"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
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
import { ContentIcon } from "@/components/ui/ContentIcon";
import { Icon } from "@/components/ui/Icon";

export function PlanClient({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
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
  const [homeworkByType, setHomeworkByType] = useState<
    Record<string, { id: string; title: string; tag: string }[]>
  >({});
  const [lessonTag, setLessonTag] = useState<Record<string, string>>({}); // lessonId -> concept tag

  useEffect(() => {
    fetch("/api/homework")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHomeworkByType(d?.byType ?? {}))
      .catch(() => void 0);
    fetch("/api/curriculum-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const map: Record<string, string> = {};
        for (const [tag, ids] of Object.entries(
          (d?.lessonsByTag ?? {}) as Record<string, string[]>,
        ))
          for (const id of ids) map[id] = tag;
        setLessonTag(map);
      })
      .catch(() => void 0);
  }, []);

  // Keep the daily XP goal in sync with the chosen plan.
  useEffect(() => {
    plan.ensureDay(isoDay());
    setDailyGoalXp(planGoalXp(plan));
  }, [plan.tier, plan.customGoalXp]); // eslint-disable-line react-hooks/exhaustive-deps

  const daysAway = lastActiveDay ? daysBetween(lastActiveDay, isoDay()) : 0;
  const routineDone = plan.routineDone.length;
  const loc = currentLocation(records, graduated, catalog.semesters, catalog.titles);
  const nextLessonId = loc.complete ? null : loc.lessonId;

  // Topics (concept tags) the student has already studied — homework reviews these.
  const learnedConcepts = new Set(
    Object.keys(records)
      .map((id) => lessonTag[id])
      .filter(Boolean),
  );

  // A different homework lesson each day per routine type (rotates by day number).
  // Drawn from topics already learned; "lesson" reviews across all types.
  const dayIndex = Math.floor(Date.parse(isoDay() + "T00:00:00Z") / 86400000);
  const pickHomework = (
    type: string,
  ): { id: string; title: string; tag: string } | null => {
    const pool =
      type === "lesson"
        ? Object.values(homeworkByType).flat()
        : (homeworkByType[type] ?? []);
    const learned = pool.filter((h) => learnedConcepts.has(h.tag));
    const usable = learned.length ? learned : pool; // fall back to all while nothing's learned yet
    return usable.length ? usable[dayIndex % usable.length]! : null;
  };

  function startAdaptiveMatch() {
    haptics.fire("success");
    audio.play("unlock");
    startMatch("bot", rating, 0, { fromHomework: true });
    router.push("/play");
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:gap-6">
        <BackButton />
        <h1 className="text-ink text-xl font-extrabold lg:text-2xl">Homework</h1>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-5">
            {/* Today's progress toward the goal */}
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-ink inline-flex items-center gap-1.5 text-sm font-extrabold">
                  <Icon name="target" size={16} className="text-brand shrink-0" />
                  Today&apos;s goal
                </span>
                <span className="text-ink-500 text-xs font-bold">
                  {Math.min(todayXp, dailyGoalXp)}/{dailyGoalXp} XP
                </span>
              </div>
              <ProgressBar
                className="mt-2"
                tone="gold"
                value={todayXp}
                max={dailyGoalXp}
                label="Daily goal progress"
              />
              <div className="text-ink-700 mt-3 flex items-center gap-2 text-xs font-bold">
                <span className="rounded-pill bg-accent/10 text-accent-600 inline-flex items-center gap-1 px-2 py-1">
                  <Icon name="flame" size={14} className="shrink-0" />
                  {streak}-day streak
                </span>
                <span className="rounded-pill bg-surface-sunken inline-flex items-center gap-1 px-2 py-1">
                  {todayXp >= dailyGoalXp ? (
                    <>
                      <Icon
                        name="sparkle"
                        size={14}
                        className="text-success shrink-0"
                      />
                      Goal reached — well done!
                    </>
                  ) : (
                    `${dailyGoalXp - todayXp} XP to go`
                  )}
                </span>
              </div>
            </Card>

            {daysAway >= 2 && (
              <Card className="border-accent-400 bg-accent/5">
                <p className="text-accent-600 inline-flex items-center gap-1.5 text-sm font-extrabold">
                  <Icon name="sparkle" size={16} className="shrink-0" />
                  Welcome back!
                </p>
                <p className="text-ink-700 mt-1 text-xs font-semibold">
                  You were away {daysAway} days — no problem, no penalties. We&apos;ve
                  kept your progress. Ease back in with one short lesson today.
                </p>
                <Link
                  href={nextLessonId ? `/lesson/${nextLessonId}` : "/"}
                  className="text-accent-600 mt-2 inline-block text-sm font-bold"
                >
                  Resume learning →
                </Link>
              </Card>
            )}

            {/* Plan tiers */}
            <section>
              <h2 className="text-ink mb-2 text-sm font-extrabold">Choose your pace</h2>
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
                        active
                          ? "border-brand bg-brand-50"
                          : "border-hairline bg-surface-card"
                      }`}
                    >
                      <ContentIcon emoji={spec.emoji} size={20} selected={active} />
                      <div className="text-ink mt-1 text-sm font-extrabold">
                        {spec.label}
                      </div>
                      <div className="text-ink-500 text-[11px] font-semibold">
                        {spec.minutes}/day
                      </div>
                    </button>
                  );
                })}
              </div>
              {plan.tier === "custom" && (
                <Card className="mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-ink text-sm font-bold">Daily XP goal</span>
                    <span className="text-brand text-sm font-extrabold">
                      {plan.customGoalXp} XP
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={10}
                    value={plan.customGoalXp}
                    onChange={(e) => plan.setCustomGoal(Number(e.target.value))}
                    className="mt-2 w-full accent-[var(--brand-500)]"
                    aria-label="Custom daily XP goal"
                  />
                </Card>
              )}
              <p className="text-ink-500 mt-2 text-xs font-semibold">
                {PLAN_SPECS[plan.tier].blurb} · Goal: {planGoalXp(plan)} XP/day ·{" "}
                {PLAN_SPECS[plan.tier].lessonsPerDay} lessons
              </p>
            </section>

            {/* Schedule */}
            <section>
              <h2 className="text-ink mb-2 text-sm font-extrabold">
                When do you study?
              </h2>
              <div className="flex gap-2">
                {(["daily", "weekdays", "weekends"] as Schedule[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      plan.setSchedule(s);
                      haptics.fire("select");
                    }}
                    className={`rounded-pill flex-1 py-2 text-sm font-bold capitalize ${
                      plan.schedule === s
                        ? "bg-brand text-white"
                        : "bg-surface-sunken text-ink-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Today's homework */}
          <section className="lg:sticky lg:top-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-ink text-sm font-extrabold">Today&apos;s homework</h2>
              <span className="text-ink-500 inline-flex items-center gap-1 text-xs font-bold">
                {routineDone}/{ROUTINE_STEPS.length} ·{" "}
                <Icon name="flame" size={12} className="shrink-0" />
                {plan.homeworkStreak}d
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {ROUTINE_STEPS.map((step) => {
                const done = plan.routineDone.includes(step.id);
                const isMatch = step.id === "match";
                // Every drill (incl. "lesson") draws from the homework pool — separate
                // puzzles, no tutorials, only topics the student has already learned.
                const hw = isMatch ? null : pickHomework(step.id);
                const href = hw ? `/homework/${hw.id}?hw=${step.id}` : step.href;
                const label = hw
                  ? `${step.label}: ${hw.title.replace(/^.*?: /, "")}`
                  : step.label;
                return (
                  <Card key={step.id} className="flex items-center gap-3 p-3">
                    {/* Display-only — checks itself when you complete the activity. */}
                    <span
                      aria-label={
                        done ? `${step.label} done` : `${step.label} not done`
                      }
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                        done
                          ? "border-success bg-success text-white"
                          : "border-hairline text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <ContentIcon emoji={step.emoji} size={18} variant="inline" />
                    <span
                      className={`min-w-0 flex-1 truncate text-sm font-bold ${done ? "text-ink-300 line-through" : "text-ink"}`}
                    >
                      {label}
                    </span>
                    {isMatch ? (
                      <button
                        onClick={startAdaptiveMatch}
                        className="text-brand shrink-0 text-sm font-bold"
                      >
                        {done ? "Again" : `Play (${rating}) →`}
                      </button>
                    ) : (
                      <Link
                        href={href}
                        className="text-brand shrink-0 text-sm font-bold"
                      >
                        {done ? "Again" : "Go →"}
                      </Link>
                    )}
                  </Card>
                );
              })}
            </div>
            {routineDone === ROUTINE_STEPS.length && (
              <p className="text-success mt-2 inline-flex items-center justify-center gap-1.5 text-center text-xs font-extrabold">
                <Icon name="sparkle" size={14} className="shrink-0" />
                Homework complete — {plan.homeworkStreak}-day streak!
              </p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}
