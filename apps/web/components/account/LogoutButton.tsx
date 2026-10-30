"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";
import { pulseTrack } from "@/lib/pulse";
import { resetLocalAccountState } from "@/core/sync/accountReset";
import { clearRuntimeCaches } from "@/core/pwa/clearRuntimeCaches";

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
    // Drop service-worker caches first: logoutAction() redirects, which can unmount
    // this component before any code after the await runs.
    await clearRuntimeCaches();
    try {
      await logoutAction();
    } catch {
      // server already best-effort; continue clearing the client either way
    }
    await clearRuntimeCaches(); // again, in case a request re-cached something mid-logout
    await resetLocalAccountState();
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
