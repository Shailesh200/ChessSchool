"use client";

import { useSettings } from "@/core/store/settings.store";
import { useProgression, isoDay } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useMatch } from "@/core/store/match.store";
import { useArena } from "@/core/store/arena.store";
import { usePlan, planGoalXp } from "@/core/store/plan.store";
import { applyTheme, getAppTheme } from "@/core/themes/themes";
import { resolvePremiumColorMode, resolveUiKit } from "@/core/themes/kitTokens";
import type { SettingsState } from "@/core/store/settings.store";
import { isRehydrateReady, markRehydrateReady } from "@/core/hooks/useRehydrateReady";

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
    | "uiKit"
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
    s.uiKit,
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
    | "uiKit"
  >,
): void {
  if (typeof document === "undefined") return;
  // Default store values land before localStorage rehydration and would paint
  // onboarding cream over a midnight bootstrap (QA-N2-006).
  if (!isRehydrateReady()) return;
  const key = settingsKey(s);
  if (key === lastAppliedKey) return;
  lastAppliedKey = key;
  const root = document.documentElement;
  const uiKit = resolveUiKit(s.uiKit);
  root.dataset.uiKit = uiKit;
  root.dataset.cb = s.colorblind === "none" ? "" : s.colorblind;
  root.dataset.rm = s.reducedMotion ? "1" : "";
  root.style.fontSize = `${Math.round(s.textScale * 100)}%`;
  root.style.setProperty("--cs-ts", String(s.textScale));
  if (s.textScale >= 1.5) root.dataset.largeText = "1";
  else delete root.dataset.largeText;
  if (s.highContrast) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  if (uiKit === "premium") {
    const mode = resolvePremiumColorMode(s.appTheme);
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
  } else {
    delete root.dataset.theme;
  }
  applyTheme(s.boardTheme, s.schoolTheme, s.appTheme, s.colorblind, uiKit);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  const themeColor =
    uiKit === "premium"
      ? modeThemeColor(resolvePremiumColorMode(s.appTheme))
      : getAppTheme(s.appTheme).swatch[0];
  meta.setAttribute("content", themeColor);
}

function modeThemeColor(mode: "light" | "dark"): string {
  return mode === "dark" ? "#17302B" : "#0F6B54";
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
    useArena.persist.rehydrate(),
    usePlan.persist.rehydrate(),
  ]).then(() => {
    const s = useSettings.getState();
    markRehydrateReady();
    applyDocumentSettings(s);
    const plan = usePlan.getState();
    plan.ensureDay(isoDay());
    useProgression.getState().setDailyGoalXp(planGoalXp(plan));
    // Persisted guest flag can lag a valid cookie. Hold at `null` until
    // ProgressSync's pullProgress confirms — avoids flashing Enroll CTAs.
    if (useSession.getState().authed === false) {
      useSession.setState({ authed: null, user: null, isAdmin: false });
    }
  });
  return bootstrapPromise;
}
