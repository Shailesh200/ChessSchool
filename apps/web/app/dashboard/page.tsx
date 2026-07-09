"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Icon } from "@/components/ui/Icon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SkillRadar } from "@/components/dashboard/SkillRadar";
import { StreakHeatmap } from "@/components/dashboard/StreakHeatmap";
import { ReportCard } from "@/components/dashboard/ReportCard";
import { MistakeReview } from "@/components/dashboard/MistakeReview";
import type { ReportClass } from "@/features/dashboard/reportCard";
import { useProgression } from "@/core/store/progression.store";
import { useMounted } from "@/core/hooks/useMounted";
import { listGames, type SavedGame } from "@/core/db/db";
import { ACHIEVEMENTS } from "@/features/progression/achievements";
import {
  skillTree,
  gameStats,
  mistakeDNA,
  graduationForecast,
} from "@/features/dashboard/analytics";

function ratingTitle(r: number): string {
  if (r >= 2000) return "Master";
  if (r >= 1600) return "Expert";
  if (r >= 1300) return "Advanced";
  if (r >= 1000) return "Intermediate";
  if (r >= 700) return "Improver";
  return "Beginner";
}

const SEV: Record<string, string> = {
  high: "bg-danger/15 text-danger",
  medium: "bg-warning/20 text-warning",
  low: "bg-ink-300/20 text-ink-700",
};

export default function DashboardPage() {
  const mounted = useMounted();
  const records = useProgression((s) => s.lessons);
  const weaknesses = useProgression((s) => s.weaknesses);
  const graduated = useProgression((s) => s.graduatedClasses);
  const streak = useProgression((s) => s.streak);
  const rating = useProgression((s) => s.rating);
  const mistakeLog = useProgression((s) => s.mistakeLog);
  const activityDays = useProgression((s) => s.activityDays);
  const unlocked = useProgression((s) => s.unlockedAchievements);
  const [today] = useState(() => new Date());
  const [games, setGames] = useState<SavedGame[]>([]);
  const [curr, setCurr] = useState<{
    totalClasses: number;
    lessonsByTag: Record<string, string[]>;
  } | null>(null);
  const [reportClasses, setReportClasses] = useState<ReportClass[]>([]);

  useEffect(() => {
    listGames().then(setGames);
    fetch("/api/curriculum-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setCurr)
      .catch(() => void 0);
    fetch("/api/report-classes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReportClasses(d?.classes ?? []))
      .catch(() => void 0);
  }, []);

  if (!mounted) {
    return (
      <AppShell>
        <div className="skeleton rounded-card h-96" />
      </AppShell>
    );
  }

  const lessonList = curr
    ? Object.entries(curr.lessonsByTag).flatMap(([tag, ids]) =>
        ids.map((id) => ({ id, tag })),
      )
    : undefined;
  const stats = gameStats(games);
  const tree = skillTree(records, lessonList);
  const findings = mistakeDNA(weaknesses, stats);
  const forecast = graduationForecast(graduated, streak, curr?.totalClasses);
  const bestGame = games
    .filter((g) => g.mode === "bot" && g.winner === "w")
    .sort((a, b) => b.moveCount - a.moveCount)[0];

  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:gap-6">
        <BackButton />
        <h1 className="text-ink text-xl font-extrabold lg:text-2xl">Report Card</h1>

        {/* Chess identity + live ELO rating (recomputed from every bot game) */}
        <Card className="flex items-center gap-4 lg:col-span-2">
          <div className="text-center">
            <AnimatedNumber
              value={rating}
              className="text-brand block text-4xl font-extrabold"
            />
            <div className="text-ink-500 text-[11px] font-semibold">
              your rating (ELO)
            </div>
          </div>
          <div className="flex-1">
            <p className="text-ink text-sm font-extrabold">Your chess identity</p>
            <span className="rounded-pill bg-brand-50 text-brand mt-1 inline-block px-3 py-1 text-sm font-extrabold">
              {ratingTitle(rating)}
            </span>
            <p className="text-ink-500 mt-1 text-xs font-semibold">
              {stats.total} games · {Math.round(stats.winRate * 100)}% win rate
            </p>
          </div>
        </Card>

        {/* Report card — per-class grades */}
        <ReportCard classes={reportClasses} records={records} graduated={graduated} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          {/* Skill tree */}
          <section>
            <h2 className="text-ink mb-2 text-sm font-extrabold">Skill tree</h2>
            <Card className="flex flex-col gap-3">
              <SkillRadar
                data={tree.map((n) => ({ area: n.area, mastery: n.mastery }))}
              />
              {tree.map((node) => (
                <div key={node.area}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-ink">{node.area}</span>
                    <span className="text-ink-500">
                      {Math.round(node.mastery * 100)}%
                    </span>
                  </div>
                  <ProgressBar
                    className="mt-1"
                    value={node.mastery}
                    max={1}
                    tone={node.mastery >= 0.9 ? "gold" : "brand"}
                    label={`${node.area} mastery`}
                  />
                </div>
              ))}
            </Card>
          </section>

          {/* Activity heatmap */}
          <section>
            <h2 className="text-ink mb-2 flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="flame" size={18} className="text-accent" /> Activity ·{" "}
              <span className="text-ink-500">{streak}-day streak</span>
            </h2>
            <Card>
              <StreakHeatmap activityDays={activityDays} today={today} />
            </Card>
          </section>

          {/* Graduation forecast */}
          <Card className="lg:col-span-2">
            <p className="text-ink flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="cap" size={18} className="text-gold" /> Graduation forecast
            </p>
            <ProgressBar
              className="mt-2"
              value={forecast.graduatedClasses}
              max={forecast.totalClasses}
              tone="gold"
              label="Graduation progress"
            />
            <p className="text-ink-500 mt-2 text-xs font-semibold">
              {forecast.graduatedClasses}/{forecast.totalClasses} classes graduated ·{" "}
              {forecast.remaining === 0
                ? "All classes complete!"
                : `~${forecast.estDays} active days to graduation`}
            </p>
          </Card>

          {/* Mistake DNA */}
          <section className="lg:col-span-2">
            <h2 className="text-ink mb-2 flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="dna" size={18} className="text-danger" /> Mistake DNA
            </h2>
            <div className="flex flex-col gap-2">
              {findings.map((f, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${SEV[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-ink flex-1 text-sm font-extrabold">
                      {f.label}
                    </span>
                  </div>
                  <p className="text-ink-500 mt-1 text-xs font-semibold">
                    {f.recommendation}
                  </p>
                </Card>
              ))}
            </div>
            <div className="mt-3 mb-2 flex items-center justify-between gap-2">
              <h3 className="text-ink-500 text-xs font-extrabold tracking-wide uppercase">
                Recent mistakes — tap to see the better move
              </h3>
              {mistakeLog.length > 0 && (
                <Link
                  href="/practice/mistakes"
                  className="text-brand shrink-0 text-xs font-extrabold"
                >
                  🎯 Practice these →
                </Link>
              )}
            </div>
            <MistakeReview mistakes={mistakeLog} />
          </section>

          {/* Trophy room */}
          <section className="lg:col-span-2">
            <h2 className="text-ink mb-2 flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="trophy" size={18} className="text-gold" /> Trophy room
            </h2>
            <Card className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Trophy label="Graduations" value={graduated.length} />
                <Trophy label="Badges" value={unlocked.length} />
                <Trophy label="Wins" value={stats.wins} />
              </div>
              {bestGame && (
                <Link href={`/review/${bestGame.id}`}>
                  <div className="rounded-card bg-surface-sunken text-ink px-3 py-2 text-sm font-bold">
                    ⭐ Best game: win vs Bot {bestGame.elo} in {bestGame.moveCount}{" "}
                    moves →
                  </div>
                </Link>
              )}
              <div className="flex flex-wrap gap-2">
                {ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)).map((a) => (
                  <span
                    key={a.id}
                    className="rounded-pill bg-gold/15 text-ink px-2 py-1 text-xs font-bold"
                  >
                    {a.emoji} {a.title}
                  </span>
                ))}
                {unlocked.length === 0 && (
                  <span className="text-ink-500 text-xs font-semibold">
                    Earn badges by learning and winning.
                  </span>
                )}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Trophy({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card bg-surface-sunken px-2 py-2">
      <AnimatedNumber value={value} className="text-ink block text-xl font-extrabold" />
      <div className="text-ink-500 text-[10px] font-semibold">{label}</div>
    </div>
  );
}
