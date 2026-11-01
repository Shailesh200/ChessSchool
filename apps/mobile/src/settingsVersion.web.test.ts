import { beforeEach, describe, expect, it, vi } from "vitest";

// Same one-time reset on the web build of the app (localStorage, no await before the reset): the
// reset must reach the account push too (pushTimer is declared before the startup load runs).

const store = vi.hoisted(() => new Map<string, string>());
const progress = vi.hoisted(() => ({ mutate: vi.fn(async () => undefined) }));
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-secure-store", () => ({}));
vi.mock("./progressStore", () => ({ mutateProgress: progress.mutate }));
vi.mock("./api", () => ({
  api: vi.fn(async () => ({})),
  getToken: vi.fn(async () => "t"),
}));

beforeEach(() => {
  store.clear();
  progress.mutate.mockClear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.useFakeTimers();
  return () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  };
});

describe("the one-time privacy reset (web build of the app)", () => {
  it("an old local 'on' becomes off, is stamped, and is pushed to the account", async () => {
    store.set("chessschool.settings", JSON.stringify({ shareAnalytics: true }));
    vi.resetModules();
    const { settings } = await import("./settings");
    expect(settings.get().shareAnalytics).toBe(false);
    expect(settings.get().settingsVersion).toBe(1);
    expect(JSON.parse(store.get("chessschool.settings")!)).toMatchObject({
      shareAnalytics: false,
      settingsVersion: 1,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(progress.mutate).toHaveBeenCalledTimes(1);
  });
});
