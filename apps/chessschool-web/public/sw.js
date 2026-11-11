// ChessSchool service worker: offline app shell. API calls are never cached.
const VERSION = "cs-v0.4.0-5";
const LESSONS = ["board", "moves", "pawns", "check", "firstGame", "castling", "special", "values", "forks", "pins", "ladder", "queenMate"].map((id) => `/lesson/${id}`);
const SOUNDS = ["move", "capture", "check", "mate", "castle", "promote", "low-time"].map((id) => `/assets/sound/${id}.wav`);
const SHELL = ["/", "/welcome", "/today", "/rooms", "/you", "/settings", "/login", "/signup", "/offline", "/orientation", "/play", "/gym", "/gym/review", "/puzzles", "/puzzles/solve", "/puzzles/sprint", "/settings/looks", "/practice", "/practice/session", ...LESSONS, ...SOUNDS, "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/v1/")) return;

  // Pages: network first, fall back to the cached page, then the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/offline")) || Response.error()),
    );
    return;
  }

  // Static build output and design assets: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

// Daily reminder: tapping it opens (or focuses) Learn.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      const open = all.find((c) => new URL(c.url).origin === self.location.origin);
      return open ? open.focus().then((c) => c.navigate(url)) : self.clients.openWindow(url);
    }),
  );
});
