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
    <div className="rounded-card border-hairline bg-surface-card flex items-center justify-between border p-4">
      <div>
        <div className="text-ink-500 text-[11px] font-bold tracking-wide uppercase">
          Player strength
        </div>
        <div className="text-ink-500 text-xs font-semibold">{title(r)}</div>
      </div>
      <div className="text-brand text-3xl font-extrabold tabular-nums">{r}</div>
    </div>
  );
}
