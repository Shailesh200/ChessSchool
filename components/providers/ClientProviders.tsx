"use client";

import { useEffect } from "react";
import { useSettings } from "@/core/store/settings.store";
import { useProgression, isoDay } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useMatch } from "@/core/store/match.store";
import { usePlan, planGoalXp } from "@/core/store/plan.store";
import { usePwa, type BeforeInstallPromptEvent } from "@/core/pwa/usePwa";
import { toast } from "@/core/store/toast.store";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import dynamic from "next/dynamic";
import { applyTheme, getAppTheme } from "@/core/themes/themes";

// Not needed at first paint — keep them out of the initial bundle.
const Toaster = dynamic(() => import("@/components/ui/Toaster").then((m) => m.Toaster), {
  ssr: false,
});
const Diagnostics = dynamic(
  () => import("@/components/dev/Diagnostics").then((m) => m.Diagnostics),
  { ssr: false },
);
const ProgressSync = dynamic(
  () => import("@/components/providers/ProgressSync").then((m) => m.ProgressSync),
  { ssr: false },
);
const NavProgress = dynamic(
  () => import("@/components/ui/NavProgress").then((m) => m.NavProgress),
  { ssr: false },
);

/**
 * App-wide side-effect coordinator: keeps device subsystems (audio, haptics,
 * document attributes) in sync with settings, registers the service worker,
 * regenerates hearts over time, and captures the PWA install prompt.
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const pwa = usePwa();

  // Rehydrate persisted stores after mount (stores use skipHydration so the
  // first client render matches SSR output).
  useEffect(() => {
    void useSettings.persist.rehydrate();
    void useProgression.persist.rehydrate();
    void useSession.persist.rehydrate();
    void useMatch.persist.rehydrate();
    void Promise.resolve(usePlan.persist.rehydrate()).then(() => {
      const plan = usePlan.getState();
      plan.ensureDay(isoDay());
      useProgression.getState().setDailyGoalXp(planGoalXp(plan));
    });
  }, []);

  // Sync settings -> subsystems + document.
  useEffect(() => {
    audio.configure({ enabled: settings.sound, volume: settings.volume });
    haptics.setEnabled(settings.haptics);
    const root = document.documentElement;
    root.dataset.cb = settings.colorblind === "none" ? "" : settings.colorblind;
    root.dataset.rm = settings.reducedMotion ? "1" : "";
    root.style.fontSize = `${Math.round(settings.textScale * 100)}%`;
    if (settings.highContrast) root.dataset.contrast = "high";
    else delete root.dataset.contrast;
    applyTheme(settings.boardTheme, settings.schoolTheme, settings.appTheme);
    // Match the device status bar / PWA chrome to the active surface.
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", getAppTheme(settings.appTheme).swatch[0]);
  }, [
    settings.sound,
    settings.volume,
    settings.haptics,
    settings.colorblind,
    settings.reducedMotion,
    settings.textScale,
    settings.highContrast,
    settings.boardTheme,
    settings.schoolTheme,
    settings.appTheme,
  ]);

  // Unlock the audio context on the first user gesture (mobile requirement).
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Register the service worker.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener("statechange", () => {
              if (sw.state === "installed" && navigator.serviceWorker.controller) {
                usePwa.getState().setUpdateReady(true);
              }
            });
          });
        })
        .catch(() => void 0);
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Prompt to reload when a new build is ready (the SW already skipWaiting'd;
  // a reload swaps in the new assets).
  useEffect(() => {
    if (!pwa.updateReady) return;
    toast("A new version is ready", {
      tone: "success",
      sticky: true,
      action: { label: "Reload", onClick: () => window.location.reload() },
    });
  }, [pwa.updateReady]);

  // Capture install prompt + installed state.
  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      pwa.setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      pwa.setInstalled(true);
      audio.play("install");
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {children}
      <ProgressSync />
      <NavProgress />
      <Toaster />
      <Diagnostics />
    </>
  );
}
