/** Dashboard analytics — ported from apps/web/features/dashboard/analytics.ts (simplified). */

export function graduationForecast(graduatedCount: number, streak: number, totalClasses = 61) {
  const remaining = Math.max(0, totalClasses - graduatedCount);
  const pace = Math.max(0.25, streak > 0 ? 0.4 + streak * 0.05 : 0.35);
  const estDays = remaining === 0 ? 0 : Math.ceil(remaining / pace);
  return { graduatedClasses: graduatedCount, totalClasses, remaining, estDays };
}

type GameStat = { wins: number; total: number; winRate: number };

export function gameStatsFromRecent(recent: { result?: string; mode?: string }[]): GameStat {
  const bot = recent.filter((g) => g.mode === "bot" || g.mode === "online");
  const wins = bot.filter((g) => g.result === "win").length;
  const total = bot.length;
  return { wins, total, winRate: total ? wins / total : 0 };
}

export function mistakeDNA(
  weaknesses: Record<string, number>,
  stats: GameStat,
): { label: string; severity: "high" | "medium" | "low"; recommendation: string }[] {
  const tags = Object.entries(weaknesses).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const out: { label: string; severity: "high" | "medium" | "low"; recommendation: string }[] = [];
  for (const [tag, n] of tags) {
    const severity = n >= 5 ? "high" : n >= 2 ? "medium" : "low";
    out.push({
      label: `${tag} · ${n} misses`,
      severity,
      recommendation:
        tag.includes("endgame") ? "Drill basic king-and-pawn endings in Endgame School."
        : tag.includes("opening") ? "Replay your opening lessons — aim for smooth development."
        : "Revisit tactics puzzles tagged for this theme.",
    });
  }
  if (stats.total >= 3 && stats.winRate < 0.35) {
    out.push({
      label: "Match results trending down",
      severity: "medium",
      recommendation: "Try a lower bot rating or review recent losses in Replay.",
    });
  }
  if (!out.length) {
    out.push({
      label: "No pattern yet",
      severity: "low",
      recommendation: "Complete lessons and play a few bot games — your Mistake DNA will appear here.",
    });
  }
  return out;
}
