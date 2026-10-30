/*
 * DuoChess service worker — offline-first, hand-rolled (Turbopack-friendly).
 * Strategies mirror Workbox: precache app shell, network-first navigation with
 * offline fallback, cache-first immutable static assets.
 */
// Bump this on any content/curriculum change to purge stale caches.
// v9: signed-in HTML and /api/* are network-only; logout wipes runtime caches (W-H4).
// v10: precache the empty-state illustrations and the /offline mascot's optimised
// /_next/image URLs so they render offline on first use (UI-W-017).
const VERSION = "chessschool-v10";
const APP_SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

// Pages whose HTML depends on who is signed in (server-rendered with the session
// cookie). They are NEVER cached and NEVER served from a cache: offline they fall
// back to the generic /offline page, so a previous user's data can't be replayed.
const USER_PAGES = new Set([
  "/account",
  "/library", // role-dependent (admin vs student view)
  "/placement",
  "/onboarding",
  "/login", // redirects when signed in
  "/register",
]);
const USER_PAGE_PREFIXES = ["/account/", "/admin"];

function isUserPage(url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return USER_PAGES.has(path) || USER_PAGE_PREFIXES.some((p) => path.startsWith(p));
}

function isApi(url) {
  return url.pathname === "/api" || url.pathname.startsWith("/api/");
}

// Next.js App Router data fetches (RSC payloads / prefetches) carry the same
// per-user data as the HTML, so they follow the network-only rule too.
function isRscRequest(request, url) {
  return request.headers.has("rsc") || url.searchParams.has("_rsc");
}

/**
 * Only cache a response that is public, complete and cookie-free. Responses marked
 * `private` / `no-store` (what Next sends for anything that reads the session) or
 * that set a cookie are never stored. `Set-Cookie` is a forbidden response header
 * for scripts, so it is usually invisible here — the Cache-Control gate plus the
 * route allow/deny lists above are the real protection; the check stays as defence
 * in depth for runtimes that do expose it.
 */
function isCacheable(res) {
  if (!res || res.status !== 200 || res.type !== "basic" || res.redirected)
    return false;
  if (res.headers.has("set-cookie")) return false;
  const cc = (res.headers.get("cache-control") || "").toLowerCase();
  return !/(^|[\s,])(private|no-store)(\s*[,=]|$)/.test(cc);
}

function putIfCacheable(cacheName, request, res) {
  if (!isCacheable(res)) return;
  const copy = res.clone();
  caches.open(cacheName).then((c) => c.put(request, copy));
}

/** Delete every runtime cache (all versions). Shell (precache) is kept. */
function clearRuntimeCaches() {
  return caches
    .keys()
    .then((keys) =>
      Promise.all(
        keys
          .filter((k) => /^chessschool-.*-runtime$/.test(k))
          .map((k) => caches.delete(k)),
      ),
    );
}

// Public, user-independent shells only. User-specific pages (/library, …) are
// deliberately absent — see USER_PAGES.
const PRECACHE = [
  "/",
  "/academy",
  "/play",
  "/profile",
  "/review",
  "/settings",
  "/dashboard",
  "/plan",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/mascots/cody-happy-v2.png",
  // EmptyState illustrations (/library, /review): plain <img>, never fetched before
  // the first offline visit unless they are precached.
  "/svg/empty/empty-library.svg",
  "/svg/empty/empty-review.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((path) =>
            fetch(path, { credentials: "omit" })
              .then(async (res) => {
                if (!isCacheable(res)) return;
                // The offline page is hydrated by hashed static chunks; cache them too,
                // otherwise the fallback renders the error boundary when truly offline.
                // It also renders the mascot through next/image, i.e. /_next/image?url=…
                // URLs (src + srcset), which are cached under their exact URL (UI-W-017).
                const html = path === "/offline" ? await res.clone().text() : "";
                const assets = [
                  ...new Set([
                    ...(html.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? []),
                    ...(html.match(/\/_next\/image\?[^"'\s,]+/g) ?? []).map((u) =>
                      u.replace(/&amp;/g, "&"),
                    ),
                  ]),
                ];
                await cache.put(path, res);
                await Promise.all(
                  assets.map((a) =>
                    fetch(a, { credentials: "omit" })
                      .then((r) => (isCacheable(r) ? cache.put(a, r) : undefined))
                      .catch(() => undefined),
                  ),
                );
              })
              .catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(`${VERSION}-`)).map((k) => caches.delete(k)),
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
    url.pathname.startsWith("/engine/") || // Stockfish wasm/js — cache-first after first use
    /\.(?:css|js|woff2?|png|svg|jpg|jpeg|webp|wasm)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Server-side logout / account deletion made through fetch (e.g. the mobile-style
  // API): wipe the runtime caches once the server has answered.
  if (
    (request.method === "POST" && url.pathname === "/api/auth/logout") ||
    (request.method === "DELETE" && url.pathname === "/api/account")
  ) {
    event.respondWith(
      fetch(request).then((res) => {
        event.waitUntil(clearRuntimeCaches());
        return res;
      }),
    );
    return;
  }

  if (request.method !== "GET") return;

  // All API responses and RSC data: network-only. Not calling respondWith hands
  // the request straight to the browser — nothing is read from or written to a cache.
  if (isApi(url) || isRscRequest(request, url)) return;

  // Signed-in navigations: network-only, generic offline page if the network is down.
  if (request.mode === "navigate" && isUserPage(url)) {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match("/offline")) || Response.error(),
      ),
    );
    return;
  }
  if (isUserPage(url)) return;

  // App navigations: network-first, fall back to cache, then offline page.
  // Only public, cookie-free 200s are stored (see isCacheable).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          putIfCacheable(RUNTIME, request, res);
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
            putIfCacheable(RUNTIME, request, res);
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Everything else: try cache, then network. ignoreVary is scoped to /_next/image
  // only: it answers with `Vary: Accept`, and the precache fetch's Accept differs
  // from an <img>'s (UI-W-017). Nothing else gets the looser match.
  const matchOptions =
    url.pathname === "/_next/image" ? { ignoreVary: true } : undefined;
  event.respondWith(
    caches.match(request, matchOptions).then((cached) => cached || fetch(request)),
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  // Sent by the page on logout / account deletion / session loss.
  if (event.data && event.data.type === "CLEAR_RUNTIME_CACHES") {
    event.waitUntil(clearRuntimeCaches());
  }
});

// Background sync stub — local-first app has no backend; reserved for future
// cross-device features. Present so registration succeeds where supported.
self.addEventListener("sync", (event) => {
  if (event.tag === "chessschool-sync") {
    event.waitUntil(Promise.resolve());
  }
});
