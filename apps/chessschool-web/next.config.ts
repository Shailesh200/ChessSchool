import type { NextConfig } from "next";

const API_URL = process.env.CHESSSCHOOL_API_URL ?? "http://localhost:3300";

/**
 * Content Security Policy, report-only for now: the browser logs what it would block without breaking anything.
 * Pulse analytics (connect-src) is listed; switch the header name to the enforcing one once the console stays quiet.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_PULSE_ORIGIN ?? "https://pulse.shaileshjha.in"} https://api.chess-school.in https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://accounts.google.com https://lichess1.org https://explorer.lichess.ovh https:`,
  "frame-src https://accounts.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const config: NextConfig = {
  transpilePackages: ["@chessschool/design", "@chessschool/chess", "@shailesh200/pulse-tracker"],
  poweredByHeader: false,
  // "Draft with AI" in the lesson editor can take a few minutes; the default proxy timeout is 30 s.
  experimental: { proxyTimeout: 180_000 },
  // The API is proxied so the session cookie stays first-party.
  async rewrites() {
    return [{ source: "/v1/:path*", destination: `${API_URL}/v1/:path*` }];
  },
  async redirects() {
    return [
      { source: "/rooms", destination: "/gym", permanent: false },
      { source: "/rooms/play", destination: "/gym", permanent: false },
      { source: "/rooms/practice", destination: "/practice", permanent: false },
      { source: "/club", destination: "/rooms/club", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default config;
