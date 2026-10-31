import { beforeEach, describe, expect, it, vi } from "vitest";

// The one-time privacy reset on mobile: everyone goes to "analytics off" once. The settings carry a
// version, on the device and on the account, so the reset never runs twice and an old "on" (saved
// locally or stored on the account) can not come back.

const disk = vi.hoisted(() => new Map<string, string>());
const progress = vi.hoisted(() => ({ mutate: vi.fn() }));
const acct = vi.hoisted(() => ({ settings: null as unknown }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void disk.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => disk.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void disk.delete(k)),
}));
vi.mock("./progressStore", () => ({ mutateProgress: progress.mutate }));
vi.mock("./api", () => ({
  api: vi.fn(async (path: string) =>
    path.includes("/api/progress") ? { settings: acct.settings } : {},
  ),
  getToken: vi.fn(async () => "t"),
}));

const KEY = "chessschool.settings";
const saved = () => JSON.parse(disk.get(KEY) ?? "null");

async function boot() {
  vi.resetModules();
  const settingsMod = await import("./settings");
  const track = await import("./productAnalytics/track");
  const apiMod = await import("./api");
  vi.mocked(apiMod.api).mockClear();
  await vi.advanceTimersByTimeAsync(10); // the saved settings finish loading
  return { ...settingsMod, ...track, api: vi.mocked(apiMod.api) };
}

beforeEach(() => {
  disk.clear();
  acct.settings = null;
  progress.mutate.mockReset();
  progress.mutate.mockResolvedValue(undefined);
  vi.useFakeTimers();
  return () => vi.useRealTimers();
});

describe("the one-time privacy reset (device)", () => {
  it("an old local 'on' becomes off, and the copy on disk is stamped", async () => {
    disk.set(KEY, JSON.stringify({ shareAnalytics: true, haptics: false }));
    const r = await boot();
    expect(r.settings.get().shareAnalytics).toBe(false);
    expect(r.settings.get().settingsVersion).toBe(1);
    expect(r.settings.get().haptics).toBe(false); // nothing else is touched
    expect(saved()).toMatchObject({ shareAnalytics: false, settingsVersion: 1 });
  });

  it("an old local 'on' sends nothing after the reset, and a fresh install is at the version", async () => {
    disk.set(KEY, JSON.stringify({ shareAnalytics: true }));
    const r = await boot();
    r.trackEvent("page_view", { route: "/" }, "/");
    await vi.advanceTimersByTimeAsync(5000);
    expect(
      r.api.mock.calls.filter((c) => String(c[0]).includes("/api/events")),
    ).toHaveLength(0);
    disk.clear();
    expect((await boot()).settings.get().settingsVersion).toBe(1);
  });

  it("the reset runs only once: an opt-in made after it survives a reload, and another", async () => {
    disk.set(KEY, JSON.stringify({ shareAnalytics: true }));
    let r = await boot();
    expect(r.settings.get().shareAnalytics).toBe(false);
    r.settings.set("shareAnalytics", true);
    expect(saved()).toMatchObject({ shareAnalytics: true, settingsVersion: 1 });
    r = await boot(); // reload
    expect(r.settings.get().shareAnalytics).toBe(true);
    r = await boot(); // and again
    expect(r.settings.get().shareAnalytics).toBe(true);
  });

  it("the reset is pushed to the account stamped with the version", async () => {
    disk.set(KEY, JSON.stringify({ shareAnalytics: true }));
    await boot();
    await vi.advanceTimersByTimeAsync(1000);
    expect(progress.mutate).toHaveBeenCalledTimes(1);
    const update = progress.mutate.mock.calls[0]![0] as (s: object) => {
      settings: object;
    };
    expect(update({}).settings).toMatchObject({
      shareAnalytics: false,
      settingsVersion: 1,
    });
  });

  it("a current-version copy is not pushed or changed on boot", async () => {
    disk.set(KEY, JSON.stringify({ shareAnalytics: true, settingsVersion: 1 }));
    const r = await boot();
    await vi.advanceTimersByTimeAsync(1000);
    expect(r.settings.get().shareAnalytics).toBe(true);
    expect(progress.mutate).not.toHaveBeenCalled();
  });
});

describe("account sync and the privacy reset (device)", () => {
  it("an old account 'on' (no version, or an older one) becomes off", async () => {
    const r = await boot();
    r.hydrateSettings({ shareAnalytics: true, haptics: false });
    expect(r.settings.get().shareAnalytics).toBe(false);
    expect(r.settings.get().haptics).toBe(false); // other settings still sync
    r.hydrateSettings({ shareAnalytics: true, settingsVersion: 0 });
    expect(r.settings.get().shareAnalytics).toBe(false);
    expect(r.settings.get().settingsVersion).toBe(1);
  });

  it("an old account 'on' from loadSettingsFromAccount (login) becomes off", async () => {
    const r = await boot();
    acct.settings = { shareAnalytics: true };
    await r.loadSettingsFromAccount();
    expect(r.settings.get().shareAnalytics).toBe(false);
  });

  it("an opt-in made after the reset survives a sync from an old account copy", async () => {
    const r = await boot();
    r.settings.set("shareAnalytics", true);
    r.hydrateSettings({ shareAnalytics: false }); // old copy, no version
    expect(r.settings.get().shareAnalytics).toBe(true);
    acct.settings = { shareAnalytics: true };
    await r.loadSettingsFromAccount();
    expect(r.settings.get().shareAnalytics).toBe(true);
    expect(saved()).toMatchObject({ shareAnalytics: true, settingsVersion: 1 });
  });

  it("an opt-in made on another device (current version) reaches this one, and an opt-out too", async () => {
    const r = await boot();
    r.hydrateSettings({ shareAnalytics: true, settingsVersion: 1 });
    expect(r.settings.get().shareAnalytics).toBe(true);
    r.hydrateSettings({ shareAnalytics: false, settingsVersion: 1 });
    expect(r.settings.get().shareAnalytics).toBe(false);
  });

  it("a current-version account copy that never stored the flag is off", async () => {
    const r = await boot();
    r.settings.set("shareAnalytics", true);
    r.hydrateSettings({ settingsVersion: 1, avatar: "ava-other" });
    expect(r.settings.get().shareAnalytics).toBe(false);
  });

  it("the settings pushed to the account carry the version", async () => {
    const r = await boot();
    r.settings.set("shareAnalytics", true);
    await vi.advanceTimersByTimeAsync(1000);
    const update = progress.mutate.mock.calls.at(-1)![0] as (s: object) => {
      settings: object;
    };
    expect(update({}).settings).toMatchObject({
      shareAnalytics: true,
      settingsVersion: 1,
    });
  });

  it("the wipe keeps the version and leaves analytics off", async () => {
    const r = await boot();
    r.settings.set("shareAnalytics", true);
    r.settings.reset();
    expect(r.settings.get()).toMatchObject({
      shareAnalytics: false,
      settingsVersion: 1,
    });
  });
});
