"use client";

import { dayKey, goalMet, reminderMood, reminderPlan, reminderText } from "@chessschool/design";
import { useEffect } from "react";
import { notificationsSupported } from "@/lib/notifications";
import { useApp } from "@/lib/state";

/** Shows the daily reminder while the app is open (browsers can't schedule it for later). */
export function ReminderClock() {
  const { state, ready } = useApp();
  const enabled = ready && state.prefs.notifications === "granted";
  const [next] = enabled ? reminderPlan(state, new Date(), 1) : [];
  const at = next?.getTime() ?? 0;
  const { name } = state.profile;

  useEffect(() => {
    if (!at || !notificationsSupported() || Notification.permission !== "granted") return;
    const delay = at - Date.now();
    if (delay <= 0 || delay > 24 * 3_600_000) return;
    const t = setTimeout(async () => {
      if (goalMet(state.progress, state.profile.dailyMinutes, dayKey(new Date()))) return;
      const now = new Date();
      const { title, body } = reminderText(reminderMood(state, now), name, now.getDate());
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, { body, icon: "/assets/raster/pwa-192.png", tag: "daily", data: { url: "/today" } });
      else new Notification(title, { body, tag: "daily" });
    }, delay);
    return () => clearTimeout(t);
    // The plan only changes with these inputs; the latest progress is read when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, name]);

  return null;
}
