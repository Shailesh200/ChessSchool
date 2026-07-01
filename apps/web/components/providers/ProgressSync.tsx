"use client";

import { useEffect, useRef } from "react";
import { useProgression } from "@/core/store/progression.store";
import { usePlan } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import { pullProgress, fullSnapshotAsync } from "@/core/sync/pullProgress";
import { onSyncTrigger } from "@/core/sync/syncTrigger";
import { toast } from "@/core/store/toast.store";

/**
 * Two-way progress sync (#1). On mount: pull the account snapshot (the account is
 * the source of truth — it hydrates local state, or absorbs a guest's progress on
 * first login). On any change while logged in: debounced push of the full snapshot
 * (progression + homework) back to the account.
 */
export function ProgressSync() {
  const lastPushed = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    const before = useProgression.getState();
    const guestHadProgress = before.xp > 0 || Object.keys(before.lessons).length > 0;
    pullProgress().then(async (user) => {
      if (cancelled || !user) return;
      lastPushed.current = JSON.stringify(await fullSnapshotAsync());
      if (guestHadProgress) {
        toast("Your progress is now saved to your account ✓", { tone: "success", icon: "check" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced push on change to either store (logged-in only).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (useSession.getState().authed !== true) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const body = JSON.stringify(await fullSnapshotAsync());
        if (body === lastPushed.current) return;
        lastPushed.current = body;
        fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        }).catch(() => void 0);
      }, 1500);
    };
    const unsubP = useProgression.subscribe(schedule);
    const unsubPlan = usePlan.subscribe(schedule);
    const unsubSettings = useSettings.subscribe(schedule);
    const unsubJournal = onSyncTrigger(schedule);
    return () => {
      clearTimeout(timer);
      unsubP();
      unsubPlan();
      unsubSettings();
      unsubJournal();
    };
  }, []);

  return null;
}
