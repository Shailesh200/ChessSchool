"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BotAvatar } from "@/features/play/BotAvatar";
import { useMatch } from "@/core/store/match.store";
import { useArena } from "@/core/store/arena.store";
import { useProgression } from "@/core/store/progression.store";
import {
  ARENA_ELO_BANDS,
  arenaGamesPlayed,
  arenaStandings,
  isArenaComplete,
  type ArenaBot,
} from "@/features/play/arena";
import { startNav } from "@/core/store/nav.store";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";

function startArenaGame(
  start: ReturnType<typeof useMatch.getState>["start"],
  runId: string,
  bandElo: number,
  opponent: ArenaBot,
) {
  haptics.fire("success");
  audio.play("unlock");
  start("bot", opponent.elo, 0, {
    arena: {
      runId,
      opponentId: opponent.id,
      bandElo,
      opponentName: opponent.name,
    },
  });
  startNav();
}

export function ArenaHub() {
  const router = useRouter();
  const start = useMatch((s) => s.start);
  const active = useArena((s) => s.active);
  const arenaStart = useArena((s) => s.start);
  const nextOpponent = useArena((s) => s.nextOpponent);
  const abandon = useArena((s) => s.abandon);
  const history = useProgression((s) => s.arenaHistory);

  const runInProgress = active && !isArenaComplete(active);
  const standings = active ? arenaStandings(active) : null;
  const next = nextOpponent();

  function beginBand(bandElo: number) {
    if (runInProgress) return;
    arenaStart(bandElo);
    const run = useArena.getState().active;
    const opp = run ? useArena.getState().nextOpponent() : null;
    if (!run || !opp) return;
    startArenaGame(start, run.id, bandElo, opp);
    router.push("/play");
  }

  function continueRun() {
    if (!active || !next) return;
    startArenaGame(start, active.id, active.bandElo, next);
    router.push("/play");
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-4 pb-8">
        <BackButton fallback="/play" />
        <h1 className="text-ink text-xl font-extrabold">Arena tournament</h1>
        <p className="text-ink-500 text-sm font-semibold">
          Four-bot round robin at your chosen level — climb the standings and earn bonus
          XP when the run finishes.
        </p>

        {runInProgress && active && standings && (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="text-ink text-sm font-extrabold">
                Round {arenaGamesPlayed(active) + 1} of {active.opponents.length}
              </p>
              <span className="text-ink-500 text-xs font-bold">
                Band ~{active.bandElo}
              </span>
            </div>
            {next && (
              <p className="text-ink-500 mt-1 text-xs font-semibold">
                Next: {next.name} · {next.elo}
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-1.5">
              {standings.map((row, i) => (
                <li
                  key={row.id}
                  className={`rounded-card flex items-center justify-between px-3 py-2 text-sm ${
                    row.isPlayer
                      ? "bg-brand-50 border-brand/30 border"
                      : "bg-surface-sunken"
                  }`}
                >
                  <span className="text-ink font-extrabold">
                    {i + 1}. {row.name}
                    {row.isPlayer ? " (you)" : ""}
                  </span>
                  <span className="text-ink-500 font-bold tabular-nums">
                    {row.points} pt{row.points === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {next ? (
                <Button size="sm" onClick={continueRun}>
                  {arenaGamesPlayed(active) === 0 ? "Start round 1" : "Next round"}
                </Button>
              ) : (
                <Button size="sm" onClick={() => router.push("/play")}>
                  View last game
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  abandon();
                  haptics.fire("select");
                }}
              >
                Abandon run
              </Button>
            </div>
          </Card>
        )}

        {!runInProgress && (
          <Card>
            <p className="text-ink mb-2 text-sm font-extrabold">Choose ELO band</p>
            <div className="grid grid-cols-2 gap-2">
              {ARENA_ELO_BANDS.map((elo) => (
                <button
                  key={elo}
                  type="button"
                  onClick={() => beginBand(elo)}
                  className="rounded-card border-hairline bg-surface-card hover:border-brand/40 flex items-center gap-2 border p-3 text-left transition-colors"
                >
                  <BotAvatar elo={elo} size={40} />
                  <span>
                    <span className="text-ink block text-sm font-extrabold">{elo}</span>
                    <span className="text-ink-500 text-xs font-semibold">4 bots</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {history.length > 0 && (
          <Card>
            <p className="text-ink mb-2 flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="trophy" size={16} className="text-brand" />
              Recent arenas
            </p>
            <ul className="flex flex-col gap-2">
              {history.slice(0, 5).map((h) => (
                <li
                  key={h.id}
                  className="rounded-card bg-surface-sunken flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="text-ink font-bold">
                    #{h.placement} · {h.playerPoints} pts
                  </span>
                  <span className="text-ink-500 text-xs font-semibold">
                    ~{h.bandElo} · +{h.xpEarned} XP
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
