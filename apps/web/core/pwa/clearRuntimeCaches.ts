/**
 * Wipe everything the service worker may have cached at runtime. Called when the
 * signed-in identity goes away (logout, account deletion, session loss) so the next
 * user — or an offline reload — can never be served the previous user's pages (W-H4).
 *
 * Belt and braces: ask the service worker to delete its runtime caches AND delete
 * them directly from the page. Cache Storage is origin-wide, so the direct delete
 * works even when no worker controls this page yet (or an old v8 worker is still
 * active and doesn't understand the message).
 *
 * Never throws; safe to call on the server (no-op).
 */
const RUNTIME_CACHE = /^chessschool-.*-runtime$/;

export async function clearRuntimeCaches(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if ("serviceWorker" in navigator) {
      const worker =
        navigator.serviceWorker.controller ??
        (await navigator.serviceWorker.getRegistration())?.active ??
        null;
      worker?.postMessage({ type: "CLEAR_RUNTIME_CACHES" });
    }
  } catch {
    // best effort — the direct delete below still runs
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => RUNTIME_CACHE.test(k)).map((k) => caches.delete(k)),
      );
    }
  } catch {
    // best effort
  }
}
