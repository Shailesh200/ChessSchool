import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Performance sharing (Core Web Vitals -> /api/vitals) is opt-in and rides the SAME single switch
// as product analytics (shareAnalytics). There is no separate sharePerformance setting.

type Cb = (m: unknown) => void;
const cbs = vi.hoisted(() => ({ lcp: null as Cb | null, inp: null as Cb | null }));
vi.mock("web-vitals", () => ({
  onLCP: (cb: Cb) => void (cbs.lcp = cb),
  onINP: (cb: Cb) => void (cbs.inp = cb),
  onCLS: () => undefined,
  onFCP: () => undefined,
  onTTFB: () => undefined,
}));

const beacon = vi.fn((..._args: unknown[]) => true);
const metric = (name: string) => ({
  name,
  value: 1200,
  rating: "good",
  navigationType: "navigate",
});
const vitalsPosts = () =>
  beacon.mock.calls.filter((c) => String(c[0]).includes("/api/vitals")).length +
  (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
    String(c[0]).includes("/api/vitals"),
  ).length;

async function boot() {
  vi.resetModules();
  cbs.lcp = null;
  cbs.inp = null;
  const [vitals, store] = await Promise.all([
    import("./reportVitals"),
    import("@/core/store/settings.store"),
  ]);
  vitals.initVitalsReporting();
  return { useSettings: store.useSettings };
}

beforeEach(() => {
  localStorage.clear();
  beacon.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
  Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
});
afterEach(() => vi.unstubAllGlobals());

describe("performance sharing is opt-in, on the same switch as analytics", () => {
  it("a fresh install sends 0 requests to /api/vitals, then sends after the user opts in", async () => {
    const r = await boot();
    await r.useSettings.persist.rehydrate();
    cbs.lcp?.(metric("LCP"));
    cbs.inp?.(metric("INP"));
    expect(vitalsPosts()).toBe(0);

    r.useSettings.getState().set("shareAnalytics", true);
    // a metric that arrived while off did not use up its slot
    cbs.lcp?.(metric("LCP"));
    expect(vitalsPosts()).toBe(1);
    expect(beacon.mock.calls[0]?.[0]).toBe("/api/vitals");
  });

  it("settings not rehydrated yet count as off, even with a saved opt-in", async () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        state: { shareAnalytics: true, settingsVersion: 1 },
        version: 14,
      }),
    );
    const r = await boot();
    cbs.lcp?.(metric("LCP"));
    expect(vitalsPosts()).toBe(0);
    await r.useSettings.persist.rehydrate();
    cbs.inp?.(metric("INP"));
    expect(vitalsPosts()).toBe(1);
  });

  it("an old saved sharePerformance: true does not send anything (no separate switch any more)", async () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        state: { sharePerformance: true, shareAnalytics: false },
        version: 11,
      }),
    );
    const r = await boot();
    await r.useSettings.persist.rehydrate();
    expect("sharePerformance" in r.useSettings.getState()).toBe(false);
    cbs.lcp?.(metric("LCP"));
    expect(vitalsPosts()).toBe(0);
  });

  it("opting out stops the vitals", async () => {
    const r = await boot();
    r.useSettings.getState().set("shareAnalytics", true);
    r.useSettings.getState().set("shareAnalytics", false);
    cbs.lcp?.(metric("LCP"));
    expect(vitalsPosts()).toBe(0);
  });

  it("the settings screen shows one privacy switch, not two", () => {
    const page = readFileSync(join(process.cwd(), "app/settings/page.tsx"), "utf8");
    const privacy = page.slice(page.indexOf('id="privacy"'));
    const panel = privacy.slice(0, privacy.indexOf("</SettingsPanel>"));
    expect(panel.match(/<Toggle/g)).toHaveLength(1);
    expect(page).not.toContain("sharePerformance");
    expect(page).not.toContain("Share performance data");
  });
});
