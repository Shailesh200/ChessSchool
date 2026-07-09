"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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
  if (g.winner === null) return "draw";
  // Online: "You" may be white or black — result is relative to your seat.
  if (g.mode === "online") {
    const myColor = g.whiteName === "You" ? "w" : "b";
    return g.winner === myColor ? "win" : "loss";
  }
  if (g.endReason === "resign") return g.mode === "bot" ? "resign" : "win";
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
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Mascot expression="think" size={56} />
        <div>
          <h1 className="text-ink text-xl font-extrabold">Review</h1>
          <p className="text-ink-500 text-sm font-semibold">
            Replay every game and learn from it.
          </p>
        </div>
      </div>

      {suggestion && (
        <Card className="border-accent-400 bg-accent/5">
          <p className="text-accent-600 text-xs font-extrabold tracking-wide uppercase">
            Recommended class
          </p>
          <p className="text-ink mt-1 text-sm font-bold">
            You&apos;ve been slipping on{" "}
            <span className="text-accent-600">{topTag}</span>.
          </p>
          <Link href={`/lesson/${suggestion.id}`}>
            <Button className="mt-3" variant="accent">
              {suggestion.emoji} Review {suggestion.title}
            </Button>
          </Link>
        </Card>
      )}

      <section>
        <h2 className="text-ink mb-2 text-sm font-extrabold">Match history</h2>
        {games === null ? (
          <div className="skeleton rounded-card h-24" />
        ) : games.length === 0 ? (
          <EmptyState
            illustration="review"
            title="No games yet"
            description="Play a match and it'll appear here with a full replay."
            action={{ label: "Play a match", href: "/play" }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {games.map((g) => {
              const o = outcome(g);
              const badge = RESULT_BADGE[o]!;
              return (
                <Link key={g.id} href={`/review/${g.id}`}>
                  <Card className="flex items-center gap-3 p-3">
                    <span
                      className={`rounded-pill shrink-0 px-2.5 py-1 text-xs font-extrabold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-sm font-extrabold">
                        {g.mode === "bot"
                          ? `vs Bot ${g.elo ?? ""}`
                          : g.mode === "online"
                            ? "vs Friend (online)"
                            : "vs Human"}
                      </p>
                      <p className="text-ink-500 truncate text-xs font-semibold">
                        {g.moveCount} moves · {g.endReason} ·{" "}
                        {new Date(g.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-brand shrink-0">→</span>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
