import { beforeEach, describe, expect, it, vi } from "vitest";

// The one-time reset: everyone goes to "analytics off" once. The settings carry a version, locally
// and on the account, so the reset never runs twice and an old "on" can not come back.

const KEY = "chessschool.settings";
const save = (state: Record<string, unknown>, version: number) =>
  localStorage.setItem(KEY, JSON.stringify({ state, version }));
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

async function boot() {
  vi.resetModules();
  const store = await import("./settings.store");
  await store.useSettings.persist.rehydrate();
  return store;
}

beforeEach(() => localStorage.clear());

describe("the one-time privacy reset (local)", () => {
  it("an old local 'on' (saved before the reset) becomes off", async () => {
    save({ shareAnalytics: true, haptics: false }, 12);
    const { useSettings } = await boot();
    expect(useSettings.getState().shareAnalytics).toBe(false);
    expect(useSettings.getState().settingsVersion).toBe(1);
    expect(useSettings.getState().haptics).toBe(false); // nothing else is touched
  });

  it("older saved versions are reset too", async () => {
    save({ shareAnalytics: true }, 11);
    expect((await boot()).useSettings.getState().shareAnalytics).toBe(false);
  });

  it("a fresh install is off and already at the current version", async () => {
    const { useSettings, PRIVACY_SETTINGS_VERSION } = await boot();
    expect(useSettings.getState().shareAnalytics).toBe(false);
    expect(useSettings.getState().settingsVersion).toBe(PRIVACY_SETTINGS_VERSION);
  });

  it("the reset runs only once: an opt-in made after it survives a reload, and another", async () => {
    save({ shareAnalytics: true }, 12);
    let r = await boot();
    expect(r.useSettings.getState().shareAnalytics).toBe(false);
    r.useSettings.getState().set("shareAnalytics", true);
    expect(saved().state.settingsVersion).toBe(1);

    r = await boot(); // reload
    expect(r.useSettings.getState().shareAnalytics).toBe(true);
    r = await boot(); // and again
    expect(r.useSettings.getState().shareAnalytics).toBe(true);
  });

  it("the stored copy carries the version, so the account push carries it too", async () => {
    save({ shareAnalytics: true }, 12);
    const { useSettings } = await boot();
    useSettings.getState().set("haptics", false);
    expect(saved().state.settingsVersion).toBe(1);
    expect(saved().version).toBe(14);
  });

  it("reset() puts analytics off and keeps the version", async () => {
    const { useSettings } = await boot();
    useSettings.getState().set("shareAnalytics", true);
    useSettings.getState().reset();
    expect(useSettings.getState().shareAnalytics).toBe(false);
    expect(useSettings.getState().settingsVersion).toBe(1);
  });
});
