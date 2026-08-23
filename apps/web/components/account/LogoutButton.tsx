"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import { usePlan } from "@/core/store/plan.store";
import { pulseTrack } from "@/lib/pulse";

/**
 * Logout that also wipes client-side personal state, so the next user/guest never
 * sees the previous account's streak, lessons, badges, ELO, etc. (#10).
 */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    pulseTrack("logout", { platform: "web" });
    try {
      await logoutAction();
    } catch {
      // server already best-effort; continue clearing the client either way
    }
    useProgression.getState().reset();
    usePlan.setState({
      routineDay: null,
      routineDone: [],
      homeworkStreak: 0,
      homeworkLastDay: null,
    });
    useSession.getState().setSession(false, null);
    useSettings.getState().set("targetElo", 600); // back to the default opponent
    router.replace("/login");
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="rounded-pill border-danger/45 bg-danger/10 text-danger hover:bg-danger/15 border-2 px-4 py-1.5 text-sm font-bold disabled:opacity-50"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
