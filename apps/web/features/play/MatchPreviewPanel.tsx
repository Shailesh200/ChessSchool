"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ChessBoard } from "@/features/board/ChessBoard";
import { useMounted } from "@/core/hooks/useMounted";
import { botProfile } from "@/features/play/bots";
import { BotAvatar } from "@/features/play/BotAvatar";
import type { MatchMode } from "@/core/store/match.store";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Static preview panel for Play desktop layout (lg+). */
export function MatchPreviewPanel({
  mode,
  targetElo,
  adaptive,
  rating,
  timeMin,
}: {
  mode: MatchMode;
  targetElo: number;
  adaptive: boolean;
  rating: number;
  timeMin: number;
}) {
  const mounted = useMounted();
  const elo = adaptive ? rating : targetElo;
  const bot = mode === "bot" ? botProfile(elo) : null;
  const timeLabel = timeMin === 0 ? "No clock" : `${timeMin} min per side`;

  return (
    <aside className="hidden lg:block">
      <Card className="sticky top-6 flex flex-col gap-4 p-5">
        <p className="text-ink text-sm font-extrabold">Match preview</p>
        {bot && (
          <div className="flex items-center gap-3">
            <BotAvatar elo={elo} size={64} />
            <div>
              <p className="text-ink text-sm font-extrabold">{bot.name}</p>
              <p className="text-ink-500 text-xs font-semibold">Rated ~{elo}</p>
            </div>
          </div>
        )}
        <div className="mx-auto w-full max-w-[420px]">
          {mounted ? (
            <ChessBoard fen={START_FEN} interactive={false} showNotation />
          ) : (
            <div className="skeleton aspect-square w-full rounded-lg" />
          )}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <PreviewRow
            icon="play"
            label="Mode"
            value={mode === "bot" ? "vs Bot" : "vs Human"}
          />
          {bot && (
            <PreviewRow icon="target" label="Opponent" value={`${bot.name} (${elo})`} />
          )}
          {mode === "pass" && (
            <PreviewRow icon="share" label="Opponent" value="Two players or online" />
          )}
          <PreviewRow icon="calendar" label="Clock" value={timeLabel} />
        </div>
        {bot && <p className="text-ink-500 text-xs font-semibold">{bot.blurb}</p>}
      </Card>
    </aside>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: "play" | "target" | "share" | "calendar";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon name={icon} size={16} className="text-brand mt-0.5 shrink-0" />
      <span>
        <span className="text-ink-500 block text-[10px] font-bold tracking-wide uppercase">
          {label}
        </span>
        <span className="text-ink font-extrabold">{value}</span>
      </span>
    </div>
  );
}
