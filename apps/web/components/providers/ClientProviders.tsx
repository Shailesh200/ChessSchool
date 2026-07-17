"use client";

import { useEffect, useRef } from "react";
import { useSettings } from "@/core/store/settings.store";
import { usePwa, type BeforeInstallPromptEvent } from "@/core/pwa/usePwa";
import { registerServiceWorker } from "@/core/pwa/registerServiceWorker";
import { toast } from "@/core/store/toast.store";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import dynamic from "next/dynamic";
import {
  applyDocumentSettings,
  rehydrateAllStores,
} from "@/core/bootstrap/storeBootstrap";
import { trackEvent } from "@/core/analytics/track";
import { ProgressSync } from "@/components/providers/ProgressSync";
import { initVitalsReporting } from "@/core/vitals/reportVitals";

// Not needed at first paint — keep them out of the initial bundle.
const Toaster = dynamic(
  () => import("@/components/ui/Toaster").then((m) => m.Toaster),
  {
    ssr: false,
  },
);
const Diagnostics = dynamic(
  () => import("@/components/dev/Diagnostics").then((m) => m.Diagnostics),
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
  const updateToastShown = useRef(false);

  // Rehydrate persisted stores once; register Core Web Vitals reporters.
  useEffect(() => {
    void rehydrateAllStores();
    initVitalsReporting();
  }, []);

  // Sync settings -> subsystems + document.
  useEffect(() => {
    audio.configure({ enabled: settings.sound, volume: settings.volume });
    haptics.setEnabled(settings.haptics);
    applyDocumentSettings(settings);
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

  // Register the service worker and watch for published updates.
  useEffect(() => {
    return registerServiceWorker(() => {
      usePwa.getState().setUpdateReady(true);
    });
  }, []);

  // Sticky snackbar when a new build is published (reload picks up new assets).
  useEffect(() => {
    if (!pwa.updateReady || updateToastShown.current) return;
    updateToastShown.current = true;
    toast("A new version is published", {
      tone: "success",
      sticky: true,
      icon: "sparkle",
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
      trackEvent("pwa_install");
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
