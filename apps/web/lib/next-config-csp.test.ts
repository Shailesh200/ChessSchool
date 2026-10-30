import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ withSentryConfig: <T>(config: T) => config }));

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

async function loadHeaderRules(): Promise<HeaderRule[]> {
  const mod = await import("../next.config");
  const config = mod.default as { headers?: () => Promise<HeaderRule[]> };
  return (await config.headers?.()) ?? [];
}

async function cspDirectives(): Promise<Map<string, string[]>> {
  const rules = await loadHeaderRules();
  const rule = rules.find((r) => r.source === "/(.*)");
  const csp = rule?.headers.find((h) => h.key === "Content-Security-Policy")?.value;
  expect(csp, "site-wide Content-Security-Policy").toBeTruthy();
  const map = new Map<string, string[]>();
  for (const part of csp!.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

describe("Content-Security-Policy connect-src (DP-X-011)", () => {
  it("does not let the browser connect to the database host", async () => {
    const connect = (await cspDirectives()).get("connect-src") ?? [];
    expect(connect.length).toBeGreaterThan(0);
    expect(connect.filter((v) => /turso/i.test(v))).toEqual([]);
  });

  it("still allows the realtime, vitals and error-reporting origins the app uses", async () => {
    const connect = (await cspDirectives()).get("connect-src") ?? [];
    for (const origin of [
      "'self'",
      "https://*.ably.io",
      "wss://*.ably.io",
      "https://vitals.vercel-insights.com",
      "https://va.vercel-scripts.com",
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://pulse.shaileshjha.in",
    ]) {
      expect(connect, origin).toContain(origin);
    }
  });
});
