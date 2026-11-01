import { beforeEach, describe, expect, it, vi } from "vitest";

// Generation re-checks after an await that can outlive a logout:
//  - mutateProgress, after it waited for its base (the GET, or the guest copy);
//  - pullRemote, after it wrote the games cache and before it hydrates the settings.

type Deferred = { promise: Promise<unknown>; resolve: (v: unknown) => void };
function deferred(): Deferred {
  let resolve!: (v: unknown) => void;
  const promise = new Promise<unknown>((r) => (resolve = r));
  return { promise, resolve };
}

const secure = vi.hoisted(() => ({
  setItemAsync: vi.fn(async (_k: string, _v: string): Promise<void> => undefined),
  getItemAsync: vi.fn(async (_k: string): Promise<string | null> => null),
  deleteItemAsync: vi.fn(async () => undefined),
}));
const tokenBox = vi.hoisted(() => ({ token: "token" as string | null }));
const settings = vi.hoisted(() => ({
  hydrateSettings: vi.fn(),
  loadSettingsFromAccount: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => secure);
vi.mock("./settings", () => settings);
vi.mock("./api", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { ApiError, api: vi.fn(), getToken: vi.fn(async () => tokenBox.token) };
});

import { api } from "./api";
import { mutateProgress, progressStore } from "./progressStore";

const apiMock = vi.mocked(api);
const tick = () => new Promise((r) => setTimeout(r, 0));
async function until(cond: () => boolean) {
  for (let i = 0; i < 200 && !cond(); i++) await tick();
}
const posts = () =>
  apiMock.mock.calls.filter(([, o]) => (o as { method?: string })?.method === "POST");

beforeEach(() => {
  apiMock.mockReset();
  secure.setItemAsync.mockReset();
  secure.setItemAsync.mockImplementation(async () => undefined);
  secure.getItemAsync.mockReset();
  secure.getItemAsync.mockImplementation(async () => null);
  settings.hydrateSettings.mockClear();
  tokenBox.token = "token";
  progressStore.clear();
});

describe("mutateProgress re-checks the generation after it waited for its base", () => {
  it("runs the edit when nothing was cleared (control)", async () => {
    const fn = vi.fn((s: Record<string, unknown>) => ({ ...s, xp: 5 }));
    apiMock.mockImplementation(((path: string, opts?: { method?: string }) =>
      Promise.resolve(
        opts?.method === "POST" ? { ok: true, count: 1 } : { xp: 1, lessons: {} },
      )) as never);
    await mutateProgress(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(posts()).toHaveLength(1);
  });

  it("drops the edit when clear() ran while it waited for the base GET (no POST under the next token)", async () => {
    const flight = deferred();
    apiMock.mockReturnValueOnce(flight.promise as never); // the base GET
    const fn = vi.fn((s: Record<string, unknown>) => ({ ...s, xp: 600 }));
    const done = mutateProgress(fn);
    await until(() => apiMock.mock.calls.length === 1);

    progressStore.clear(); // logout while the edit waits for its base
    flight.resolve({ xp: 1, lessons: {}, user: { id: "A" } });
    await done;

    expect(fn).not.toHaveBeenCalled();
    expect(posts()).toHaveLength(0);
    expect(progressStore.get()).toBeNull();
  });

  it("drops the edit when clear() ran while it loaded the guest copy (nothing saved as guest progress)", async () => {
    tokenBox.token = null;
    const read = deferred();
    secure.getItemAsync.mockImplementation((() => read.promise) as never);
    const fn = vi.fn((s: Record<string, unknown>) => ({ ...s, xp: 600 }));
    const done = mutateProgress(fn);
    await until(() => secure.getItemAsync.mock.calls.length === 1);

    progressStore.clear();
    read.resolve(JSON.stringify({ xp: 3, lessons: {} }));
    await done;

    expect(fn).not.toHaveBeenCalled();
    expect(secure.setItemAsync).not.toHaveBeenCalled();
  });
});

describe("pullRemote re-checks the generation before it hydrates the settings", () => {
  const reply = {
    xp: 40,
    lessons: {},
    user: { id: "A" },
    recentGames: [{ id: "g1" }],
    settings: { theme: "old-users-theme" },
  };

  it("hydrates the settings when nothing was cleared (control)", async () => {
    apiMock.mockResolvedValueOnce(reply);
    const { fetchProgress } = await import("./progressStore");
    await fetchProgress(true);
    expect(settings.hydrateSettings).toHaveBeenCalledTimes(1);
  });

  it("does not hydrate the old user's settings when clear() ran during the games cache write", async () => {
    const write = deferred();
    secure.setItemAsync.mockImplementation((() => write.promise) as never);
    apiMock.mockResolvedValueOnce(reply);
    const { fetchProgress } = await import("./progressStore");
    const pull = fetchProgress(true);
    await until(() => secure.setItemAsync.mock.calls.length === 1);

    progressStore.clear(); // logout while the games cache is being written
    write.resolve(undefined);
    const result = await pull;

    expect(result).toBeNull();
    expect(settings.hydrateSettings).not.toHaveBeenCalled();
    expect(progressStore.get()).toBeNull();
  });
});
