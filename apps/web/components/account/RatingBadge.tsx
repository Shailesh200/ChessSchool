"use client";

import { useProgression } from "@/core/store/progression.store";
import { useMounted } from "@/core/hooks/useMounted";

function title(r: number): string {
  if (r >= 2000) return "Master";
  if (r >= 1600) return "Expert";
  if (r >= 1300) return "Advanced";
  if (r >= 1000) return "Intermediate";
  if (r >= 700) return "Improver";
  return "Beginner";
}

/** The player's live strength (ELO), shown on the student ID. */
export function RatingBadge() {
  const mounted = useMounted();
  const rating = useProgression((s) => s.rating);
  const r = mounted ? rating : 800;
  return (
    <div className="flex items-center justify-between rounded-card border border-hairline bg-surface-card p-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Player strength</div>
        <div className="text-xs font-semibold text-ink-500">{title(r)}</div>
      </div>
      <div className="text-3xl font-extrabold tabular-nums text-brand">{r}</div>
    </div>
  );
}
