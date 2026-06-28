"use client";

import { AppShell } from "@/components/layout/AppShell";
import { CampusMap } from "@/features/school/CampusMap";
import { ResumeCard } from "@/features/school/ResumeCard";
import { Mascot } from "@/components/ui/Mascot";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useProgression } from "@/core/store/progression.store";
import type { Catalog } from "@/features/school/structure";

export function HomeClient({ catalog }: { catalog: Catalog }) {
  const todayXp = useProgression((s) => s.todayXp);
  const dailyGoal = useProgression((s) => s.dailyGoalXp);
  const streak = useProgression((s) => s.streak);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Mascot expression="wave" size={64} float={false} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold text-ink">
              {streak > 0 ? `Day ${streak} at the academy` : "Welcome to ChessSchool!"}
            </h1>
            <p className="text-sm font-semibold text-ink-500">
              Graduate through classes. Become a stronger player.
            </p>
          </div>
        </div>

        <ResumeCard catalog={catalog} />

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
