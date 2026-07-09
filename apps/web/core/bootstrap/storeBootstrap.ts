"use client";

import { useSettings } from "@/core/store/settings.store";
import { useProgression, isoDay } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useMatch } from "@/core/store/match.store";
import { usePlan, planGoalXp } from "@/core/store/plan.store";
import { applyTheme, getAppTheme } from "@/core/themes/themes";
import type { SettingsState } from "@/core/store/settings.store";
import { markRehydrateReady } from "@/core/hooks/useRehydrateReady";

let bootstrapPromise: Promise<void> | null = null;
let lastAppliedKey = "";

function settingsKey(
  s: Pick<
    SettingsState,
    | "colorblind"
    | "reducedMotion"
    | "textScale"
    | "highContrast"
    | "boardTheme"
    | "schoolTheme"
    | "appTheme"
  >,
): string {
  return [
    s.colorblind,
    s.reducedMotion,
    s.textScale,
    s.highContrast,
    s.boardTheme,
    s.schoolTheme,
    s.appTheme,
  ].join("|");
}

/** Apply theme + accessibility attrs to <html> (shared by bootstrap + settings effect). */
export function applyDocumentSettings(
  s: Pick<
    SettingsState,
    | "colorblind"
    | "reducedMotion"
    | "textScale"
    | "highContrast"
    | "boardTheme"
    | "schoolTheme"
    | "appTheme"
  >,
): void {
  if (typeof document === "undefined") return;
  const key = settingsKey(s);
  if (key === lastAppliedKey) return;
  lastAppliedKey = key;
  const root = document.documentElement;
  root.dataset.cb = s.colorblind === "none" ? "" : s.colorblind;
  root.dataset.rm = s.reducedMotion ? "1" : "";
  root.style.fontSize = `${Math.round(s.textScale * 100)}%`;
  if (s.highContrast) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  applyTheme(s.boardTheme, s.schoolTheme, s.appTheme);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", getAppTheme(s.appTheme).swatch[0]);
}

/**
 * Rehydrate persisted Zustand stores once, then apply document theme from settings.
 * ProgressSync waits on this so pullProgress never races localStorage hydration.
 */
export function rehydrateAllStores(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = Promise.all([
    useSettings.persist.rehydrate(),
    useProgression.persist.rehydrate(),
    useSession.persist.rehydrate(),
    useMatch.persist.rehydrate(),
    usePlan.persist.rehydrate(),
  ]).then(() => {
    const s = useSettings.getState();
    applyDocumentSettings(s);
    const plan = usePlan.getState();
    plan.ensureDay(isoDay());
    useProgression.getState().setDailyGoalXp(planGoalXp(plan));
    markRehydrateReady();
  });
  return bootstrapPromise;
}
