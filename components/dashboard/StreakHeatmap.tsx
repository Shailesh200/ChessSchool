import { isoDay } from "@/core/store/progression.store";

const WEEKS = 13;
const LEVEL_COLORS = ["var(--surface-sunken)", "#c7d2fe", "#a5b4fc", "#818cf8", "#5b5bd6"];

function level(xp: number): number {
  if (xp === 0) return 0;
  if (xp < 20) return 1;
  if (xp < 50) return 2;
  if (xp < 100) return 3;
  return 4;
}

/** GitHub-style activity heatmap of the last ~13 weeks (XP earned per day). */
export function StreakHeatmap({ activityDays, today }: { activityDays: Record<string, number>; today: Date }) {
  const start = new Date(today);
  start.setDate(today.getDate() - (WEEKS * 7 - 1));
  const cells: { day: string; xp: number }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const day = isoDay(d);
    cells.push({ day, xp: activityDays[day] ?? 0 });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-[3px] overflow-x-auto">
        {Array.from({ length: WEEKS }, (_, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, d) => {
              const cell = cells[w * 7 + d]!;
              return (
                <div
                  key={d}
                  title={`${cell.day}: ${cell.xp} XP`}
                  className="h-3 w-3 rounded-[3px]"
                  style={{ background: LEVEL_COLORS[level(cell.xp)] }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] font-semibold text-ink-500">
        <span>Less</span>
        {LEVEL_COLORS.map((c, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
