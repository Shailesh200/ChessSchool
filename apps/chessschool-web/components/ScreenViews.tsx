"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { setAnalyticsAllowed, trackScreen } from "@/lib/analytics";
import { useApp } from "@/lib/state";

/** One Pulse screen view per route, once saved prefs are loaded (so an opt-out is known before anything is sent). */
export function ScreenViews() {
  const path = usePathname();
  const { ready, state } = useApp();
  useEffect(() => {
    if (!ready) return;
    setAnalyticsAllowed(state.prefs.shareUsage);
    trackScreen(path);
  }, [ready, path]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
