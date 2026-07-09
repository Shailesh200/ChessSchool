"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { botProfile } from "@/features/play/bots";
import type { MatchMode } from "@/core/store/match.store";

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
  const elo = adaptive ? rating : targetElo;
  const bot = mode === "bot" ? botProfile(elo) : null;
  const timeLabel = timeMin === 0 ? "No clock" : `${timeMin} min per side`;

  return (
    <aside className="hidden lg:block">
      <Card className="sticky top-6 flex flex-col gap-4 p-5">
        <p className="text-ink text-sm font-extrabold">Match preview</p>
        <div
          className="border-hairline aspect-square w-full max-w-[420px] rounded-xl border"
          style={{
            background:
              "linear-gradient(135deg, var(--board-light) 25%, var(--surface-sunken) 25%, var(--surface-sunken) 50%, var(--board-light) 50%, var(--board-light) 75%, var(--surface-sunken) 75%)",
            backgroundSize: "56px 56px",
          }}
          aria-hidden
        />
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
