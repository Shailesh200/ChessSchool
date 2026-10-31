import { beforeEach, describe, expect, it, vi } from "vitest";

// Product analytics is opt-in (Wave B): a fresh install sends nothing, through boot and normal use,
// until the user turns "Share usage analytics" on. The only send path in the app is trackEvent ->
// flush -> api("/api/events"); rotateAnalyticsSession and the session id never send. Sentry is a
// separate crash reporter and is not covered here.

const disk = vi.hoisted(() => new Map<string, string>());
const gate = vi.hoisted(() => ({
  settingsLoad: null as Promise<void> | null,
  settingsFail: false,
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void disk.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => {
    // "not loaded yet": the saved settings are still being read from the keychain
    if (k === "chessschool.settings" && gate.settingsLoad) await gate.settingsLoad;
    if (k === "chessschool.settings" && gate.settingsFail)
      throw new Error("keychain locked");
    return disk.get(k) ?? null;
  }),
  deleteItemAsync: vi.fn(async (k: string) => void disk.delete(k)),
}));
// settings.set() pushes to the account through progressStore; not under test here
vi.mock("./progressStore", () => ({ mutateProgress: vi.fn(async () => undefined) }));
vi.mock("./api", () => ({
  api: vi.fn(async () => ({})),
  getToken: vi.fn(async () => "t"),
}));

async function boot() {
  vi.resetModules();
  // one import at a time: parallel imports after resetModules raced the mock registry
  const settingsMod = await import("./settings");
  const track = await import("./productAnalytics/track");
  const apiMod = await import("./api");
  vi.mocked(apiMod.api).mockClear();
  return { ...settingsMod, ...track, api: vi.mocked(apiMod.api) };
}
type Rig = Awaited<ReturnType<typeof boot>>;

/** A boot's worth of normal use: launch, navigation, a lesson, a game, a login, a session rotate. */
async function useTheApp(r: Rig) {
  r.trackEvent("page_view", { route: "/" }, "/");
  r.trackEvent("lesson_start", { id: 1 });
  r.trackEvent("feature_open", { feature: "arena" });
  r.trackEvent("login");
  r.trackEvent("game_end", { result: "win" });
  await r.rotateAnalyticsSession();
  r.trackEvent("page_view", { route: "/learn" }, "/learn");
  await vi.advanceTimersByTimeAsync(5000);
}
const posts = (r: Rig) =>
  r.api.mock.calls.filter((c) => String(c[0]).includes("/api/events"));

beforeEach(() => {
  disk.clear();
  gate.settingsLoad = null;
  gate.settingsFail = false;
  vi.useFakeTimers();
  return () => vi.useRealTimers();
});

describe("analytics is opt-in", () => {
  it("a fresh install defaults to analytics off", async () => {
    const r = await boot();
    expect(r.settings.get().shareAnalytics).toBe(false);
  });

  it("a fresh install sends 0 events through boot and normal use, then sends after the user opts in", async () => {
    const r = await boot();
    await useTheApp(r);
    expect(posts(r)).toHaveLength(0);
    // nothing was written for a session id either (the id is only made when something is sent)
    expect(disk.has("chessschool.analytics.session")).toBe(false);

    r.settings.set("shareAnalytics", true);
    r.trackEvent("page_view", { route: "/" }, "/");
    await vi.advanceTimersByTimeAsync(2000);
    expect(posts(r)).toHaveLength(1);
    const body = (posts(r)[0]![1] as { body: { events: { name: string }[] } }).body;
    expect(body.events.map((e) => e.name)).toEqual(["page_view"]);
  });

  it("an event made while analytics is off is not sent later when the user opts in", async () => {
    const r = await boot();
    r.trackEvent("lesson_start");
    r.settings.set("shareAnalytics", true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(posts(r)).toHaveLength(0);
  });

  it("opting out before a queued batch flushes drops the batch", async () => {
    const r = await boot();
    r.settings.set("shareAnalytics", true);
    r.trackEvent("lesson_start");
    r.settings.set("shareAnalytics", false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(posts(r)).toHaveLength(0);
  });

  it("settings not loaded yet count as not opted in; the saved opt-in applies once loaded", async () => {
    // an earlier opt-in is saved on the device, but the keychain read is still pending
    disk.set("chessschool.settings", JSON.stringify({ shareAnalytics: true }));
    let release!: () => void;
    gate.settingsLoad = new Promise<void>((res) => (release = res));
    const r = await boot();
    expect(r.settings.get().shareAnalytics).toBe(false);
    await useTheApp(r);
    expect(posts(r)).toHaveLength(0);

    release();
    await vi.advanceTimersByTimeAsync(50);
    expect(r.settings.get().shareAnalytics).toBe(true);
    // nothing from before the load was kept and sent now
    await vi.advanceTimersByTimeAsync(2000);
    expect(posts(r)).toHaveLength(0);
    r.trackEvent("page_view", { route: "/" }, "/");
    await vi.advanceTimersByTimeAsync(2000);
    expect(posts(r)).toHaveLength(1);
  });

  it("settings that fail to load stay opted out", async () => {
    disk.set("chessschool.settings", JSON.stringify({ shareAnalytics: true }));
    gate.settingsFail = true;
    const r = await boot();
    await useTheApp(r);
    expect(r.settings.get().shareAnalytics).toBe(false);
    expect(posts(r)).toHaveLength(0);
  });
});
