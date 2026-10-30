"use client";

/** Streak/XP chips for dex-style profile/settings headers inside AppShell. */
export function PremiumStatsTopbar({ streak, xp }: { streak: number; xp: number }) {
  return (
    <div className="topbar mb-2" role="group" aria-label="Your streak and XP">
      <span className="chip fire">
        <b>{streak}</b> day streak
      </span>
      <span className="chip xp">
        <b>{xp.toLocaleString()}</b> XP
      </span>
    </div>
  );
}
