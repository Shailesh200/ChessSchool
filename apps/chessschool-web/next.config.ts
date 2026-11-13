import type { NextConfig } from "next";

const API_URL = process.env.CHESSSCHOOL_API_URL ?? "http://localhost:3300";

const config: NextConfig = {
  transpilePackages: ["@chessschool/design", "@chessschool/chess"],
  poweredByHeader: false,
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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default config;
