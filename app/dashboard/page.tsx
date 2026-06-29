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
import type { ReportClass } from "@/features/dashboard/reportCard";
import { useProgression } from "@/core/store/progression.store";
import { useSettings } from "@/core/store/settings.store";
import { useMounted } from "@/core/hooks/useMounted";
import { listGames, type SavedGame } from "@/core/db/db";
import { ACHIEVEMENTS } from "@/features/progression/achievements";
import {
  skillTree,
  gameStats,
  skillEstimate,
  mistakeDNA,
  chessIdentity,
  graduationForecast,
} from "@/features/dashboard/analytics";

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
  const activityDays = useProgression((s) => s.activityDays);
  const unlocked = useProgression((s) => s.unlockedAchievements);
  const [today] = useState(() => new Date());
  const targetElo = useSettings((s) => s.targetElo);
  const [games, setGames] = useState<SavedGame[]>([]);
  const [curr, setCurr] = useState<{ totalClasses: number; lessonsByTag: Record<string, string[]> } | null>(null);
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
        <div className="skeleton h-96 rounded-card" />
      </AppShell>
    );
  }

  const lessonList = curr
    ? Object.entries(curr.lessonsByTag).flatMap(([tag, ids]) => ids.map((id) => ({ id, tag })))
    : undefined;
  const stats = gameStats(games);
  const estimate = skillEstimate(targetElo, stats, records);
  const tree = skillTree(records, lessonList);
  const findings = mistakeDNA(weaknesses, stats);
  const identity = chessIdentity(stats, records);
  const forecast = graduationForecast(graduated, streak, curr?.totalClasses);
  const bestGame = games
    .filter((g) => g.mode === "bot" && g.winner === "w")
    .sort((a, b) => b.moveCount - a.moveCount)[0];

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <BackButton />
        <h1 className="text-xl font-extrabold text-ink">Report Card</h1>

        {/* Report card — per-class grades */}
        <ReportCard classes={reportClasses} records={records} graduated={graduated} />

        {/* Skill estimate + identity */}
        <Card className="flex items-center gap-4">
          <div className="text-center">
            <AnimatedNumber value={estimate} className="block text-4xl font-extrabold text-brand" />
            <div className="text-[11px] font-semibold text-ink-500">est. strength</div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-ink">Your chess identity</p>
            <span className="mt-1 inline-block rounded-pill bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand">
              {identity}
            </span>
            <p className="mt-1 text-xs font-semibold text-ink-500">
              {stats.total} games · {Math.round(stats.winRate * 100)}% win rate
            </p>
          </div>
        </Card>

        {/* Skill tree */}
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">Skill tree</h2>
          <Card className="flex flex-col gap-3">
            <SkillRadar data={tree.map((n) => ({ area: n.area, mastery: n.mastery }))} />
            {tree.map((node) => (
              <div key={node.area}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-ink">{node.area}</span>
                  <span className="text-ink-500">{Math.round(node.mastery * 100)}%</span>
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

        {/* Graduation forecast */}
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <Icon name="cap" size={18} className="text-gold" /> Graduation forecast
          </p>
          <ProgressBar
            className="mt-2"
            value={forecast.graduatedClasses}
            max={forecast.totalClasses}
            tone="gold"
            label="Graduation progress"
          />
          <p className="mt-2 text-xs font-semibold text-ink-500">
            {forecast.graduatedClasses}/{forecast.totalClasses} classes graduated ·{" "}
            {forecast.remaining === 0
              ? "All classes complete! 🏆"
              : `~${forecast.estDays} active days to graduation`}
          </p>
        </Card>

        {/* Activity heatmap */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <Icon name="flame" size={18} className="text-accent" /> Activity ·{" "}
            <span className="text-ink-500">{streak}-day streak</span>
          </h2>
          <Card>
            <StreakHeatmap activityDays={activityDays} today={today} />
          </Card>
        </section>

        {/* Mistake DNA */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <Icon name="dna" size={18} className="text-danger" /> Mistake DNA
          </h2>
          <div className="flex flex-col gap-2">
            {findings.map((f, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${SEV[f.severity]}`}>
                    {f.severity}
                  </span>
                  <span className="flex-1 text-sm font-extrabold text-ink">{f.label}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-ink-500">{f.recommendation}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Trophy room */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-ink">
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
                <div className="rounded-card bg-surface-sunken px-3 py-2 text-sm font-bold text-ink">
                  ⭐ Best game: win vs Bot {bestGame.elo} in {bestGame.moveCount} moves →
                </div>
              </Link>
            )}
            <div className="flex flex-wrap gap-2">
              {ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)).map((a) => (
                <span key={a.id} className="rounded-pill bg-gold/15 px-2 py-1 text-xs font-bold text-ink">
                  {a.emoji} {a.title}
                </span>
              ))}
              {unlocked.length === 0 && (
                <span className="text-xs font-semibold text-ink-500">Earn badges by learning and winning.</span>
              )}
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function Trophy({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card bg-surface-sunken px-2 py-2">
      <AnimatedNumber value={value} className="block text-xl font-extrabold text-ink" />
      <div className="text-[10px] font-semibold text-ink-500">{label}</div>
    </div>
  );
}
