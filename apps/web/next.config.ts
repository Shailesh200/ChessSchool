import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/** Routes whose response depends on the signed-in user (cookie or Bearer token). */
const PRIVATE_SOURCES = [
  // pages
  "/account",
  "/account/:path*",
  "/admin",
  "/admin/:path*",
  "/library",
  "/placement",
  "/onboarding",
  "/login",
  "/register",
  // APIs that call getApiUser()
  "/api/progress",
  "/api/profile",
  "/api/profile/:path*",
  "/api/campus",
  "/api/next-lesson",
  "/api/library",
  "/api/class/:id",
  "/api/session",
  "/api/session/:id",
  "/api/ably-token",
  "/api/events",
  "/api/account",
  "/api/auth/:path*",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["framer-motion", "lottie-react"],
  },
  // Compile the shared TS workspace package(s) from source.
  transpilePackages: ["@chess-school/core", "@shailesh200/pulse-tracker"],
  // Native module must stay external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Service worker + WASM-friendly headers. The SW lives at /sw.js and must be
  // allowed to control the whole origin, and must not be aggressively cached.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // Signed-in HTML and per-user API data must never be stored by the browser,
      // a proxy, or the service worker (W-H4). Dynamic pages already send this from
      // Next; the explicit rule keeps it true if a page is ever made static, and
      // gives GET route handlers (which send no Cache-Control at all) the header.
      ...PRIVATE_SOURCES.map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      })),
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://pulse.shaileshjha.in",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://*.ably.io wss://*.ably.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://pulse.shaileshjha.in",
              "media-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "shailesh-jha",
  project: "chessschool-web",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: "/sentry-tunnel",
  silent: !process.env.CI,
  // Keep the home JS budget closer to pre-Sentry size.
  disableLogger: true,
  automaticVercelMonitors: false,
});
