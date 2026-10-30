"use client";

import Link from "next/link";
import { useProgression, levelForXp } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useMounted } from "@/core/hooks/useMounted";
import { rankForClasses } from "@/lib/rank";
import { PremiumStatsTopbar } from "@/features/premium-ui/shell/PremiumDexShell";

export function PremiumProfileScreen() {
  const mounted = useMounted();
  const xp = useProgression((s) => s.xp);
  const streak = useProgression((s) => s.streak);
  const graduated = useProgression((s) => s.graduatedClasses);
  const user = useSession((s) => s.user);
  const authed = useSession((s) => s.authed);
  const name = user?.name ?? "Guest Player";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const rank = mounted ? rankForClasses(graduated.length) : "Novice";
  const level = mounted ? levelForXp(xp) : 1;

  return (
    <>
      <PremiumStatsTopbar streak={streak} xp={xp} />
      <div className="ph">
        <span className="av" role="img" aria-label="Your picture">
          <b className="ini" aria-hidden="true">
            {initial}
          </b>
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: "2rem" }}>{name}</h1>
          <p className="muted">{authed === true ? "Student" : "Guest mode"}</p>
          <span className="pill" style={{ marginTop: ".35rem" }}>
            {rank} · Level {level}
          </span>
        </div>
      </div>
      <div className="stats3" role="list">
        <div role="listitem">
          <b>{xp.toLocaleString()}</b>
          <span>Total XP</span>
        </div>
        <div role="listitem">
          <b>{streak}</b>
          <span>Day streak</span>
        </div>
        <div role="listitem">
          <b>{graduated.length}</b>
          <span>Classes done</span>
        </div>
      </div>
      <div style={{ display: "grid", gap: ".75rem", marginTop: "1.25rem" }}>
        <Link href="/settings" className="btn soft">
          Settings
        </Link>
        <Link href="/account" className="btn line">
          My Student ID
        </Link>
        {authed === false && (
          <Link href="/login" className="btn">
            Sign in
          </Link>
        )}
      </div>
    </>
  );
}
