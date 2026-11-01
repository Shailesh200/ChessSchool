import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Product analytics is opt-in (Wave B). Web has two send paths, both gated on shareAnalytics:
// the first-party /api/events batch (trackEvent -> flush) and the Pulse tracker (pulseTrack).
// A fresh browser, and a browser whose saved settings have not rehydrated yet (the store uses
// skipHydration), sends nothing until the user opts in.

const pulse = vi.hoisted(() => ({ track: vi.fn(), identify: vi.fn() }));
vi.mock("@shailesh200/pulse-tracker", () => ({
  track: pulse.track,
  identify: pulse.identify,
}));

const beacon = vi.fn(() => true);

async function boot() {
  vi.resetModules();
  const [track, store] = await Promise.all([
    import("./track"),
    import("@/core/store/settings.store"),
  ]);
  return { ...track, useSettings: store.useSettings };
}
type Rig = Awaited<ReturnType<typeof boot>>;

function useTheSite(r: Rig) {
  r.trackEvent("page_view", { route: "/" });
  r.trackEvent("lesson_start", { id: 1 });
  r.trackEvent("feature_open", { feature: "arena" });
  r.trackEvent("login");
  r.trackEvent("signup");
}
const sent = () =>
  beacon.mock.calls.length +
  (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  beacon.mockClear();
  pulse.track.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
  Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("web analytics is opt-in", () => {
  it("a fresh install defaults to analytics off", async () => {
    const r = await boot();
    expect(r.useSettings.getState().shareAnalytics).toBe(false);
  });

  it("a fresh install sends 0 events and no Pulse events through normal use, then sends after opt-in", async () => {
    const r = await boot();
    await r.useSettings.persist.rehydrate();
    useTheSite(r);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent()).toBe(0);
    expect(pulse.track).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("chessschool.analytics.session")).toBeNull();

    r.useSettings.getState().set("shareAnalytics", true);
    r.trackEvent("lesson_start", { id: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(beacon).toHaveBeenCalledTimes(1);
    const body = await (beacon.mock.calls[0] as unknown as [string, Blob])[1].text();
    expect(JSON.parse(body).events.map((e: { name: string }) => e.name)).toEqual([
      "lesson_start",
    ]);
    expect(pulse.track).toHaveBeenCalledTimes(1);
  });

  it("events made before the saved settings have rehydrated are never sent, even when the saved opt-in loads", async () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        state: { shareAnalytics: true, settingsVersion: 1 },
        version: 14,
      }),
    );
    const r = await boot();
    expect(r.useSettings.getState().shareAnalytics).toBe(false); // not rehydrated yet
    useTheSite(r);
    await r.useSettings.persist.rehydrate();
    expect(r.useSettings.getState().shareAnalytics).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent()).toBe(0);
    expect(pulse.track).not.toHaveBeenCalled();
    // after the load, the saved opt-in is honoured
    r.trackEvent("lesson_start");
    await vi.advanceTimersByTimeAsync(2000);
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it("opting out before a queued batch flushes drops the batch", async () => {
    const r = await boot();
    r.useSettings.getState().set("shareAnalytics", true);
    r.trackEvent("lesson_start");
    r.useSettings.getState().set("shareAnalytics", false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent()).toBe(0);
  });

  it("settings saved before the key existed (v2) migrate to off, not on", async () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({ state: { sound: false }, version: 2 }),
    );
    const r = await boot();
    await r.useSettings.persist.rehydrate();
    expect(r.useSettings.getState().shareAnalytics).toBe(false);
  });

  it("reset() leaves analytics off", async () => {
    const r = await boot();
    r.useSettings.getState().set("shareAnalytics", true);
    r.useSettings.getState().reset();
    expect(r.useSettings.getState().shareAnalytics).toBe(false);
  });
});
