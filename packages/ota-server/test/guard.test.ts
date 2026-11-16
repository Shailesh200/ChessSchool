import { describe, expect, it } from "vitest";
import { guardDecision, pauseRollout, sentryReleaseHealth } from "../src";

describe("rollout guard decision", () => {
  const health = (sessions: number, crashFreeRate: number | null) => ({ release: "app@1.0.0", sessions, crashFreeRate });

  it("pauses below 99.5% crash-free with at least 50 sessions", () => {
    expect(guardDecision(health(50, 0.994)).pause).toBe(true);
    expect(guardDecision(health(4000, 0.9)).pause).toBe(true);
  });

  it("keeps going at or above the threshold", () => {
    expect(guardDecision(health(50, 0.995)).pause).toBe(false);
    expect(guardDecision(health(900, 1)).pause).toBe(false);
  });

  it("does not judge on fewer than 50 sessions, or with no rate", () => {
    expect(guardDecision(health(49, 0.5))).toMatchObject({ pause: false, reason: expect.stringContaining("not enough") });
    expect(guardDecision(health(500, null)).pause).toBe(false);
  });

  it("takes a custom policy", () => {
    expect(guardDecision(health(10, 0.98), { minCrashFreeRate: 0.99, minSessions: 10 }).pause).toBe(true);
  });
});

describe("rollout guard wrappers", () => {
  it("reads the newest release's sessions and crash-free rate from the Sentry API", async () => {
    const seen: string[] = [];
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = new URL(String(url));
      seen.push(u.pathname);
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer t");
      if (u.pathname === "/api/0/projects/org/app/") return Response.json({ id: "7" });
      if (u.pathname === "/api/0/organizations/org/releases/") return Response.json([{ version: "app@1.0.0+5" }]);
      expect(u.searchParams.getAll("field")).toEqual(["sum(session)", "crash_free_rate(session)"]);
      expect(u.searchParams.get("query")).toBe('release:"app@1.0.0+5"');
      return Response.json({ groups: [{ totals: { "sum(session)": 120, "crash_free_rate(session)": 0.99 } }] });
    }) as typeof fetch;
    expect(await sentryReleaseHealth({ token: "t", org: "org", project: "app", fetch: fake })).toEqual({ release: "app@1.0.0+5", sessions: 120, crashFreeRate: 0.99 });
    expect(seen).toHaveLength(3);
  });

  it("returns null with no releases and throws on an API error", async () => {
    const none = (async (url: string | URL | Request) => (String(url).includes("/releases/") ? Response.json([]) : Response.json({ id: "7" }))) as typeof fetch;
    expect(await sentryReleaseHealth({ token: "t", org: "org", project: "app", fetch: none })).toBeNull();
    const denied = (async () => new Response("no", { status: 403 })) as typeof fetch;
    await expect(sentryReleaseHealth({ token: "t", org: "org", project: "app", fetch: denied })).rejects.toThrow(/403/);
  });

  it("calls the channel pause route with the admin token", async () => {
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.example.com/ota/channels/production/pause");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer admin");
      return Response.json({ paused: [{ id: "u1", platform: "ios", runtimeVersion: "1.0.0" }] });
    }) as typeof fetch;
    expect((await pauseRollout({ server: "https://api.example.com/ota/", channel: "production", adminToken: "admin", fetch: fake })).paused).toHaveLength(1);
  });
});
