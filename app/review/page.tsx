"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/ui/Mascot";
import { useProgression } from "@/core/store/progression.store";
import { useMounted } from "@/core/hooks/useMounted";
import { LESSONS } from "@/features/lessons/curriculum";
import { listGames, type SavedGame } from "@/core/db/db";

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  win: { label: "Win", cls: "bg-success/15 text-success-600" },
  loss: { label: "Loss", cls: "bg-danger/15 text-danger" },
  draw: { label: "Draw", cls: "bg-ink-300/20 text-ink-700" },
  resign: { label: "Resigned", cls: "bg-warning/20 text-warning" },
};

function outcome(g: SavedGame): keyof typeof RESULT_BADGE {
  if (g.endReason === "resign") return g.mode === "bot" ? "resign" : "win";
  if (g.winner === null) return "draw";
  // vs bot: player is white
  if (g.mode === "bot") return g.winner === "w" ? "win" : "loss";
  return "win";
}

export default function ReviewPage() {
  const mounted = useMounted();
  const weaknesses = useProgression((s) => s.weaknesses);
  const [games, setGames] = useState<SavedGame[] | null>(null);

  useEffect(() => {
    listGames().then(setGames);
  }, []);

  const topTag = mounted
    ? Object.entries(weaknesses).sort((a, b) => b[1] - a[1])[0]?.[0]
    : undefined;
  const suggestion = topTag ? LESSONS.find((l) => l.tag === topTag) : undefined;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Mascot expression="think" size={56} />
          <div>
            <h1 className="text-xl font-extrabold text-ink">Review</h1>
            <p className="text-sm font-semibold text-ink-500">
              Replay every game and learn from it.
            </p>
          </div>
        </div>

        {suggestion && (
          <Card className="border-accent-400 bg-accent/5">
            <p className="text-xs font-extrabold uppercase tracking-wide text-accent-600">
              Recommended class
            </p>
            <p className="mt-1 text-sm font-bold text-ink">
              You&apos;ve been slipping on <span className="text-accent-600">{topTag}</span>.
            </p>
            <Link href={`/lesson/${suggestion.id}`}>
              <Button className="mt-3" variant="accent">
                {suggestion.emoji} Review {suggestion.title}
              </Button>
            </Link>
          </Card>
        )}

        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">Match history</h2>
          {games === null ? (
            <div className="skeleton h-24 rounded-card" />
          ) : games.length === 0 ? (
            <Card className="text-center">
              <p className="text-3xl">📋</p>
              <p className="mt-1 text-sm font-bold text-ink">No games yet</p>
              <p className="text-xs font-semibold text-ink-500">
                Play a match and it&apos;ll appear here with a full replay.
              </p>
              <Link href="/play">
                <Button className="mt-3">Play a match</Button>
              </Link>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {games.map((g) => {
                const o = outcome(g);
                const badge = RESULT_BADGE[o]!;
                return (
                  <Link key={g.id} href={`/review/${g.id}`}>
                    <Card className="flex items-center gap-3 p-3">
                      <span className={`shrink-0 rounded-pill px-2.5 py-1 text-xs font-extrabold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-ink">
                          {g.mode === "bot" ? `vs Bot ${g.elo ?? ""}` : "vs Human"}
                        </p>
                        <p className="truncate text-xs font-semibold text-ink-500">
                          {g.moveCount} moves · {g.endReason} · {new Date(g.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="shrink-0 text-brand">→</span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
