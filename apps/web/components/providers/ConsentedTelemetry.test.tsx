import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Vercel Analytics and Speed Insights load only after the user opts in (one switch: shareAnalytics).
// Off, or not rehydrated yet, mounts nothing and never imports their scripts.

const loaded = vi.hoisted(() => ({ analytics: 0, insights: 0 }));
vi.mock("@vercel/analytics/next", () => {
  loaded.analytics += 1; // evaluated only when the chunk is imported
  return { Analytics: () => <div data-testid="vercel-analytics" /> };
});
vi.mock("@vercel/speed-insights/next", () => {
  loaded.insights += 1;
  return { SpeedInsights: () => <div data-testid="vercel-speed-insights" /> };
});

async function boot() {
  vi.resetModules();
  loaded.analytics = 0;
  loaded.insights = 0;
  const [{ ConsentedTelemetry }, { useSettings }] = await Promise.all([
    import("./ConsentedTelemetry"),
    import("@/core/store/settings.store"),
  ]);
  return { ConsentedTelemetry, useSettings };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Vercel telemetry is opt-in", () => {
  it("a fresh install mounts nothing and loads no script, then mounts after opt-in", async () => {
    const { ConsentedTelemetry, useSettings } = await boot();
    await useSettings.persist.rehydrate();
    render(<ConsentedTelemetry />);
    await act(async () => void (await new Promise((r) => setTimeout(r, 20))));
    expect(screen.queryByTestId("vercel-analytics")).toBeNull();
    expect(screen.queryByTestId("vercel-speed-insights")).toBeNull();
    expect(loaded).toEqual({ analytics: 0, insights: 0 });

    await act(async () => useSettings.getState().set("shareAnalytics", true));
    expect(await screen.findByTestId("vercel-analytics")).toBeTruthy();
    expect(await screen.findByTestId("vercel-speed-insights")).toBeTruthy();
    expect(loaded).toEqual({ analytics: 1, insights: 1 });
  });

  it("not rehydrated yet counts as off, even with a saved opt-in; mounts once it loads", async () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({ state: { shareAnalytics: true }, version: 12 }),
    );
    const { ConsentedTelemetry, useSettings } = await boot();
    render(<ConsentedTelemetry />);
    await act(async () => void (await new Promise((r) => setTimeout(r, 20))));
    expect(screen.queryByTestId("vercel-analytics")).toBeNull();
    expect(loaded.analytics).toBe(0);

    await act(async () => void (await useSettings.persist.rehydrate()));
    expect(await screen.findByTestId("vercel-analytics")).toBeTruthy();
  });

  it("opting out unmounts it", async () => {
    const { ConsentedTelemetry, useSettings } = await boot();
    await act(async () => useSettings.getState().set("shareAnalytics", true));
    render(<ConsentedTelemetry />);
    expect(await screen.findByTestId("vercel-analytics")).toBeTruthy();
    await act(async () => useSettings.getState().set("shareAnalytics", false));
    expect(screen.queryByTestId("vercel-analytics")).toBeNull();
    expect(screen.queryByTestId("vercel-speed-insights")).toBeNull();
  });

  it("the root layout does not import the Vercel scripts itself", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/@vercel\/(analytics|speed-insights)/);
    expect(layout).toContain("<ConsentedTelemetry />");
  });

  it("only VercelTelemetry imports the Vercel scripts, and ConsentedTelemetry loads it lazily", () => {
    const gate = readFileSync(
      join(process.cwd(), "components/providers/ConsentedTelemetry.tsx"),
      "utf8",
    );
    expect(gate).not.toMatch(/from "@vercel\//);
    expect(gate).toMatch(/lazy\(\(\) => import\("\.\/VercelTelemetry"\)\)/);
    expect(gate).toContain("if (!optedIn) return null;");
  });
});
