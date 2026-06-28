"use client";

import { useEffect, useRef } from "react";
import {
  useProgression,
  progressSnapshot,
  type ProgressSnapshot,
} from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";

/**
 * Two-way progress sync (#1). On mount: pull the account snapshot and merge it
 * into the local store (this also carries a guest's local progress up to a
 * freshly-created account — guest→account migration). On any change while
 * logged in: debounced push of the merged union back to the account.
 */
export function ProgressSync() {
  const setSession = useSession((s) => s.setSession);
  const lastPushed = useRef<string>("");

  // Pull + merge on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/progress")
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          setSession(false, null);
          return;
        }
        if (!r.ok) return;
        const data = (await r.json()) as ProgressSnapshot & { user: { name: string; role: string } };
        useProgression.getState().mergeSnapshot(data);
        // Seed the dedupe key so the merge itself doesn't trigger a no-op push.
        lastPushed.current = JSON.stringify(progressSnapshot(useProgression.getState()));
        setSession(true, data.user);
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [setSession]);

  // Debounced push on change (logged-in only).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useProgression.subscribe(() => {
      if (useSession.getState().authed !== true) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const body = JSON.stringify(progressSnapshot(useProgression.getState()));
        if (body === lastPushed.current) return;
        lastPushed.current = body;
        fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        }).catch(() => void 0);
      }, 1500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return null;
}
