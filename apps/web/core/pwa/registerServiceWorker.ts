/**
 * Register the app service worker and detect published updates.
 * SPA navigations don't always trigger SW update checks, so we also poll on
 * focus / visibility and once an hour while the tab stays open.
 */
export function registerServiceWorker(onUpdateReady: () => void): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }

  let cancelled = false;
  let registration: ServiceWorkerRegistration | null = null;
  let intervalId: number | undefined;

  const markReady = () => {
    // First install has no controller — don't treat that as "new version".
    if (cancelled || !navigator.serviceWorker.controller) return;
    onUpdateReady();
  };

  const watchWorker = (sw: ServiceWorker | null) => {
    if (!sw) return;
    if (sw.state === "installed") markReady();
    sw.addEventListener("statechange", () => {
      if (sw.state === "installed") markReady();
    });
  };

  const checkForUpdate = () => {
    void registration?.update().catch(() => undefined);
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") checkForUpdate();
  };

  const start = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        if (reg.waiting) markReady();
        watchWorker(reg.installing);
        reg.addEventListener("updatefound", () => {
          watchWorker(reg.installing);
        });
        checkForUpdate();
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", checkForUpdate);
        intervalId = window.setInterval(checkForUpdate, 60 * 60 * 1000);
      })
      .catch(() => undefined);
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);

  return () => {
    cancelled = true;
    window.removeEventListener("load", start);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", checkForUpdate);
    if (intervalId !== undefined) window.clearInterval(intervalId);
  };
}
