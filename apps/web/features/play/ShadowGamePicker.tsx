"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { listGames, type SavedGame } from "@/core/db/db";
import { useMatch } from "@/core/store/match.store";
import { shadowFromGame } from "@/features/play/shadow";
import { startNav } from "@/core/store/nav.store";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";

function outcomeLabel(g: SavedGame): string {
  if (g.winner === "w") return g.whiteName === "You" ? "Win" : "Loss";
  if (g.winner === "b") return g.blackName === "You" ? "Win" : "Loss";
  return "Draw";
}

export function ShadowGamePicker() {
  const router = useRouter();
  const start = useMatch((s) => s.start);
  const [games, setGames] = useState<SavedGame[] | null>(null);

  useEffect(() => {
    void listGames().then((rows) =>
      setGames(rows.filter((g) => g.moveCount >= 2 && g.pgn?.trim()).slice(0, 40)),
    );
  }, []);

  function begin(game: SavedGame, flipColor = false) {
    const shadow = shadowFromGame(game, { flipColor });
    if (!shadow) return;
    haptics.fire("success");
    audio.play("unlock");
    start("shadow", 0, 0, {
      shadow: {
        sourceGameId: shadow.gameId,
        shadowPgn: shadow.pgn,
        playerColor: shadow.playerColor,
        opponentName: shadow.opponentName,
        flipped: shadow.flipped,
      },
    });
    startNav();
    router.push("/play");
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-4 pb-8">
        <BackButton fallback="/play" />
        <h1 className="text-ink text-xl font-extrabold">Shadow opponent</h1>
        <p className="text-ink-500 text-sm font-semibold">
          Replay a past game — you keep your seat, the opponent&apos;s moves play
          automatically from that game.
        </p>

        {games === null && <div className="skeleton rounded-card h-40" />}

        {games?.length === 0 && (
          <Card>
            <p className="text-ink-500 text-sm font-semibold">
              Play a match first — finished games appear here for shadow rematches.
            </p>
            <Button className="mt-3" size="sm" onClick={() => router.push("/play")}>
              New match
            </Button>
          </Card>
        )}

        <ul className="flex flex-col gap-2">
          {games?.map((g) => (
            <li key={g.id}>
              <div className="rounded-card border-hairline bg-surface-card border p-3 [box-shadow:var(--shadow-card)]">
                <span className="text-ink block truncate text-sm font-extrabold">
                  {g.whiteName} vs {g.blackName}
                </span>
                <span className="text-ink-500 mt-0.5 block text-xs font-semibold">
                  {outcomeLabel(g)} · {g.moveCount} moves ·{" "}
                  {new Date(g.updatedAt).toLocaleDateString()}
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => begin(g, false)}>
                    Same seat
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => begin(g, true)}>
                    Swap sides
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
