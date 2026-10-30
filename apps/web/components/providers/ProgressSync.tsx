"use client";

import { useEffect, useRef } from "react";
import { useProgression } from "@/core/store/progression.store";
import { usePlan } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import {
  pullProgress,
  fullSnapshotAsync,
  handleSessionExpired,
} from "@/core/sync/pullProgress";
import {
  applyServerProgressAck,
  type PushedProgress,
} from "@/core/sync/applyProgressAck";
import { progressGeneration, progressSnapshot } from "@/core/store/progression.store";
import { localProgressPresent } from "@chess-school/progression";
import { onSyncTrigger } from "@/core/sync/syncTrigger";
import { toast } from "@/core/store/toast.store";
import { rehydrateAllStores } from "@/core/bootstrap/storeBootstrap";

/**
 * Two-way progress sync (#1). On mount: pull the account snapshot (the account is
 * the source of truth — it hydrates local state, or absorbs a guest's progress on
 * first login). On any change while logged in: debounced push of the full snapshot
 * (progression + homework) back to the account.
 */
export function ProgressSync() {
  const lastPushed = useRef<string>("");
  const initialSyncDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void rehydrateAllStores()
      .then(() => {
        if (cancelled) return;
        const before = useProgression.getState();
        const guestHadProgress = localProgressPresent({
          ...progressSnapshot(before),
          placementDone: before.placementDone,
        });
        return pullProgress().then(async (user) => {
          if (cancelled) return;
          if (user) {
            const generation = progressGeneration();
            const owner = useSession.getState().user?.id;
            const snapshot = await fullSnapshotAsync();
            // Logged out or switched user while the rows were read: they are not this one's.
            if (
              cancelled ||
              generation !== progressGeneration() ||
              useSession.getState().user?.id !== owner
            )
              return;
            const body = JSON.stringify(snapshot);
            lastPushed.current = body;
            if (guestHadProgress) {
              await fetch("/api/progress", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body,
              })
                .then(async (res) => {
                  if (res.status === 401) {
                    if (generation === progressGeneration()) handleSessionExpired();
                    return;
                  }
                  if (!res.ok) return;
                  applyServerProgressAck(
                    await res.json().catch(() => null),
                    snapshot as PushedProgress,
                    generation,
                  );
                })
                .catch(() => void 0);
              toast("Your progress is now saved to your account ✓", {
                tone: "success",
                icon: "check",
              });
            }
          }
        });
      })
      .finally(() => {
        if (cancelled) return;
        initialSyncDone.current = true;
        // Network / non-401 failure left session unresolved → treat as guest.
        if (useSession.getState().authed === null) {
          useSession.getState().setSession(false, null);
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
      if (!initialSyncDone.current) return;
      if (useSession.getState().authed !== true) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const generation = progressGeneration();
        const owner = useSession.getState().user?.id;
        const snapshot = await fullSnapshotAsync();
        // Logged out or switched user while the rows were read: they are not this one's.
        if (
          generation !== progressGeneration() ||
          useSession.getState().authed !== true ||
          useSession.getState().user?.id !== owner
        )
          return;
        const body = JSON.stringify(snapshot);
        if (body === lastPushed.current) return;
        lastPushed.current = body;
        fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        })
          .then(async (res) => {
            if (res.status === 401) {
              if (generation === progressGeneration()) handleSessionExpired();
              return;
            }
            if (!res.ok) return;
            applyServerProgressAck(
              await res.json().catch(() => null),
              snapshot as PushedProgress,
              generation,
            );
          })
          .catch(() => void 0);
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
