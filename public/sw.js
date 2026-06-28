/*
 * DuoChess service worker — offline-first, hand-rolled (Turbopack-friendly).
 * Strategies mirror Workbox: precache app shell, network-first navigation with
 * offline fallback, cache-first immutable static assets.
 */
// Bump this on any content/curriculum change to purge stale caches.
const VERSION = "chessschool-v4";
const APP_SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  "/",
  "/play",
  "/profile",
  "/review",
  "/settings",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(?:css|js|woff2?|png|svg|jpg|jpeg|webp)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first, fall back to cache, then offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/offline")) || Response.error();
        }),
    );
    return;
  }

  // Immutable static assets: cache-first with background refresh.
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Everything else: try cache, then network.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Background sync stub — local-first app has no backend; reserved for future
// cross-device features. Present so registration succeeds where supported.
self.addEventListener("sync", (event) => {
  if (event.tag === "duochess-sync") {
    event.waitUntil(Promise.resolve());
  }
});
