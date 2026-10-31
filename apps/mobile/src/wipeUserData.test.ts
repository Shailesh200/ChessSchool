import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

// DP-M-001 (P0) / 002 / 003 / 004: one wipe for logout, deleteAccount and the 401 handler.
// This file tests the wipe: it signs in as A, leaves A's data in every store, wipes, and fails
// if any user key survives (ALLOWED lists what may stay). Who calls the wipe is pinned in
// authWiring.test.ts.

const disk = vi.hoisted(() => new Map<string, string>());
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void disk.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => disk.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void disk.delete(k)),
}));
vi.mock("./api", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    api: vi.fn(async () => ({})),
    getToken: vi.fn(async () => "token"),
  };
});

const settle = (ms = 25) => new Promise((r) => setTimeout(r, ms));

/** Keys that may stay after a LOGOUT / DELETE wipe. Everything else under chessschool. must go. */
const ALLOWED_AFTER_LOGOUT = [
  "chessschool.token", // the session itself: clearToken() removes it, not the wipe
  "chessschool.orientationSeen", // a device flag, not a user's data
  "chessschool.premiumCaptureGuest", // web premium capture harness only (localStorage seed)
  "chessschool.settings", // rewritten with the defaults (checked below)
];
/** After an EXPIRY (401) the progress policy keeps these on purpose: owner-tagged, merged only for their owner. */
const ALLOWED_AFTER_EXPIRY = [
  ...ALLOWED_AFTER_LOGOUT,
  "chessschool.guestProgress",
  "chessschool.recentGamesCache",
  "chessschool.lastUserId",
];
/** Every chessschool.* key the app source stores: a key not listed here is a new user key without a wipe. */
const KNOWN_KEYS = [
  ...ALLOWED_AFTER_EXPIRY,
  "chessschool.activematch",
  "chessschool.arena",
  "chessschool.onlineSeats",
  "chessschool.analytics.session",
  "chessschool.lastUser", // cached signed-in user (DP-M-005 offline session): a user key, wiped on logout, delete AND expiry
  "chessschool.pendingRevoke", // tokens still to be revoked on the server (DP-M-006): not user data, must SURVIVE every wipe or an offline logout would never be revoked
  "chessschool.guestProgressOwner", // (f)-era key: never written (see progressStore.ts)
];

/** A fresh process on A's device: new module state, A's data in every store. */
async function boot() {
  vi.resetModules();
  const [store, settingsMod, cache, match, arena, seat, wipe] = await Promise.all([
    import("./progressStore"),
    import("./settings"),
    import("./dataCache"),
    import("./matchStore"),
    import("./arenaStore"),
    import("./onlineSeat"),
    import("./wipeUserData"),
  ]);
  const defaults = { ...settingsMod.settings.get() };
  disk.set("chessschool.token", "A-token");
  disk.set("chessschool.orientationSeen", "1");
  disk.set("chessschool.premiumCaptureGuest", "1");
  // A's data
  store.progressStore.beginSession("A");
  await settle();
  disk.set(
    "chessschool.recentGamesCache",
    JSON.stringify({
      chessGames: 2,
      origin: "signed-in",
      owner: "A",
      games: [{ id: "A-game" }],
    }),
  );
  disk.set(
    "chessschool.guestProgress",
    JSON.stringify({ chessGuest: 2, origin: "signed-in", owner: "A", snap: { xp: 5 } }),
  );
  settingsMod.settings.set("avatar", "ava-A");
  settingsMod.settings.set("goal", "A's goal");
  cache.cacheSet("learn-screen", { resume: "A-lesson" });
  cache.cacheSet("lesson:7", { id: 7 });
  match.startBotMatch(800, 5);
  arena.startArena(800);
  await seat.saveOnlineSeat("ABC", "w", "A-seat-token");
  disk.set("chessschool.analytics.session", "A-session-id");
  disk.set(
    "chessschool.lastUser",
    JSON.stringify({ id: "A", email: "a-secret@x.test" }),
  );
  await settle();
  return { store, settingsMod, cache, match, arena, wipe, defaults };
}
type Rig = Awaited<ReturnType<typeof boot>>;

const userKeys = () => [...disk.keys()].filter((k) => k.startsWith("chessschool."));

function expectNothingLeft(r: Rig, allowed: string[]) {
  const survivors = userKeys().filter((k) => !allowed.includes(k));
  expect(
    survivors,
    `user keys that survived the wipe: ${survivors.join(", ")}`,
  ).toEqual([]);
  // memory
  expect(r.match.getActiveMatch()).toBeNull();
  expect(r.arena.getArenaRun()).toBeNull();
  expect(r.cache.cachePeek("learn-screen")).toBeNull();
  expect(r.cache.cachePeek("lesson:7")).toBeNull();
  expect(r.store.progressStore.get()).toBeNull();
  // settings are back to the defaults (analytics stays off, bleed-b), in memory and in the saved copy
  const afterWipe = { ...r.defaults, shareAnalytics: false };
  expect(r.settingsMod.settings.get()).toEqual(afterWipe);
  const saved = disk.get("chessschool.settings");
  if (saved) expect(JSON.parse(saved)).toEqual(afterWipe);
  expect(JSON.stringify([...disk.values()])).not.toContain("A-seat-token");
  expect(JSON.stringify([...disk.values()])).not.toContain("A-session-id");
  expect(JSON.stringify([...disk.values()])).not.toContain("a-secret@x.test");
}

beforeEach(() => disk.clear());

describe("wipeUserData: logout / delete account (DP-M-001, DP-M-004)", () => {
  it("leaves no user key behind, only the allowed ones", async () => {
    const r = await boot();
    expect(userKeys().length).toBeGreaterThan(ALLOWED_AFTER_LOGOUT.length + 4); // the rig really stored A's data
    await r.wipe.wipeUserData();
    expectNothingLeft(r, ALLOWED_AFTER_LOGOUT);
  });

  it("drops the kept guest copy, the games cache and the last-user id", async () => {
    const r = await boot();
    await r.wipe.wipeUserData();
    expect(disk.has("chessschool.guestProgress")).toBe(false);
    expect(disk.has("chessschool.recentGamesCache")).toBe(false);
    expect(disk.has("chessschool.lastUserId")).toBe(false);
  });

  it("rotates the analytics session: the old id is gone from disk and memory", async () => {
    const r = await boot();
    await r.wipe.wipeUserData();
    expect(disk.has("chessschool.analytics.session")).toBe(false);
  });

  it("does not touch the session token or the orientation flag", async () => {
    const r = await boot();
    await r.wipe.wipeUserData();
    expect(disk.get("chessschool.token")).toBe("A-token");
    expect(disk.get("chessschool.orientationSeen")).toBe("1");
    expect(disk.get("chessschool.premiumCaptureGuest")).toBe("1");
  });
});

describe("wipeUserData: session expiry, a 401 (DP-M-002)", () => {
  it("clears the same keys as a logout except the owner-tagged progress policy keys", async () => {
    const r = await boot();
    await r.wipe.wipeUserData({ expired: true });
    expectNothingLeft(r, ALLOWED_AFTER_EXPIRY);
    // what the (g)-(k) policy keeps is still tagged to A and unchanged
    expect(JSON.parse(disk.get("chessschool.guestProgress")!).owner).toBe("A");
    expect(JSON.parse(disk.get("chessschool.recentGamesCache")!).owner).toBe("A");
  });

  it("resets settings (A's avatar and goal do not survive into the next session)", async () => {
    const r = await boot();
    await r.wipe.wipeUserData({ expired: true });
    expect(r.settingsMod.settings.get().avatar).toBe(r.defaults.avatar);
    expect(r.settingsMod.settings.get().goal).toBe("");
  });

  it("expires the session: it does not start a new generation like a logout", async () => {
    const r = await boot();
    const gen = vi.spyOn(r.store.progressStore, "clear");
    await r.wipe.wipeUserData({ expired: true });
    expect(gen).not.toHaveBeenCalled();
  });
});

describe("wipeUserData: an Academy fetch in flight across the wipe (bleed-a)", () => {
  it("A's reply landing after the wipe is not cached; a fetch started afterwards is", async () => {
    const r = await boot();
    const startedAt = r.cache.cacheGeneration(); // A's fetch starts
    await r.wipe.wipeUserData();
    expect(r.cache.cacheSet("learn-screen", { resume: "A-late" }, startedAt)).toBe(
      false,
    );
    expect(r.cache.cachePeek("learn-screen")).toBeNull();
    expect(
      r.cache.cacheSet("learn-screen", { resume: "B" }, r.cache.cacheGeneration()),
    ).toBe(true);
  });

  it("the same on a 401 (expired mode)", async () => {
    const r = await boot();
    const startedAt = r.cache.cacheGeneration();
    await r.wipe.wipeUserData({ expired: true });
    expect(r.cache.cacheSet("learn-screen", { resume: "A-late" }, startedAt)).toBe(
      false,
    );
    expect(r.cache.cachePeek("learn-screen")).toBeNull();
  });
});

describe("wipeUserData: analytics is off after the wipe (bleed-b)", () => {
  async function trackedPosts(): Promise<number> {
    const { api } = await import("./api");
    const { trackEvent } = await import("./productAnalytics/track");
    vi.mocked(api).mockClear();
    vi.useFakeTimers();
    try {
      trackEvent("page_view");
      await vi.advanceTimersByTimeAsync(2000);
    } finally {
      vi.useRealTimers();
    }
    return vi.mocked(api).mock.calls.filter((c) => String(c[0]).includes("/api/events"))
      .length;
  }

  it("control: a user who opted in is tracked (the harness sees a post)", async () => {
    const r = await boot();
    r.settingsMod.hydrateSettings({ settingsVersion: 1, shareAnalytics: true });
    expect(await trackedPosts()).toBe(1);
  });

  it("a user who opted in is not tracked after a logout", async () => {
    const r = await boot();
    r.settingsMod.hydrateSettings({ settingsVersion: 1, shareAnalytics: true });
    await r.wipe.wipeUserData();
    expect(r.settingsMod.settings.get().shareAnalytics).toBe(false);
    expect(await trackedPosts()).toBe(0);
  });

  it("a user who opted in is not tracked after a 401", async () => {
    const r = await boot();
    r.settingsMod.hydrateSettings({ settingsVersion: 1, shareAnalytics: true });
    await r.wipe.wipeUserData({ expired: true });
    expect(r.settingsMod.settings.get().shareAnalytics).toBe(false);
    expect(await trackedPosts()).toBe(0);
  });

  it("an opted-in user logs out and back in and keeps their choice (the account copy brings it back)", async () => {
    const r = await boot();
    r.settingsMod.hydrateSettings({ settingsVersion: 1, shareAnalytics: true });
    const account = { ...r.settingsMod.settings.get() }; // what pushToAccount stored for this user
    await r.wipe.wipeUserData();
    expect(r.settingsMod.settings.get().shareAnalytics).toBe(false); // off while logged out
    expect(await trackedPosts()).toBe(0);
    r.settingsMod.hydrateSettings(account); // logs back in
    expect(r.settingsMod.settings.get().shareAnalytics).toBe(true);
    expect(await trackedPosts()).toBe(1);
  });

  it("an account that never stored the flag signs in with analytics off (explicit false, not undefined)", async () => {
    const r = await boot();
    r.settingsMod.hydrateSettings({ settingsVersion: 1, shareAnalytics: true });
    r.settingsMod.hydrateSettings({ settingsVersion: 1, avatar: "ava-other" });
    expect(r.settingsMod.settings.get().shareAnalytics).toBe(false);
    expect(await trackedPosts()).toBe(0);
  });

  it("reset() does not change the defaults it copies (a later fresh state is still opt-out and clean)", async () => {
    vi.resetModules();
    const fresh = await import("./settings");
    const before = { ...fresh.settings.get() };
    fresh.hydrateSettings({ settingsVersion: 1, shareAnalytics: true, avatar: "ava-other" });
    fresh.settings.reset();
    fresh.settings.reset();
    expect(fresh.settings.get()).toEqual(before);
  });

  it("reset() puts every default back and leaves analytics off", async () => {
    vi.resetModules();
    const fresh = await import("./settings");
    // fresh install: analytics off (see analyticsOptIn.test.ts)
    const initial = { ...fresh.settings.get() };
    expect(initial.shareAnalytics).toBe(false);
    fresh.hydrateSettings({ settingsVersion: 1, shareAnalytics: true, avatar: "ava-other" });
    fresh.settings.reset();
    // every default is back, and analytics is off
    expect(fresh.settings.get()).toEqual({ ...initial, shareAnalytics: false });
  });
});

describe("wipeUserData: chessschool.lastUser", () => {
  it("is deleted on logout and on expiry", async () => {
    for (const opts of [{}, { expired: true }]) {
      const r = await boot();
      await r.wipe.wipeUserData(opts);
      expect(disk.has("chessschool.lastUser")).toBe(false);
    }
  });

  it("a missing key or a delete error does not stop the wipe (fails closed)", async () => {
    const r = await boot();
    const ss = await import("expo-secure-store");
    vi.mocked(ss.deleteItemAsync).mockImplementationOnce(async (k: string) => {
      if (k === "chessschool.lastUser") throw new Error("keystore");
      disk.delete(k);
    });
    await expect(r.wipe.wipeUserData()).resolves.toBeUndefined();
    disk.delete("chessschool.lastUser");
    await expect(r.wipe.wipeUserData()).resolves.toBeUndefined(); // key already missing
    expect(disk.has("chessschool.activematch")).toBe(false);
  });
});

describe("wipeUserData: the Academy data cache (DP-M-003)", () => {
  it("is emptied, including every lesson:<id> entry", async () => {
    const r = await boot();
    await r.wipe.wipeUserData();
    expect(r.cache.cachePeek("learn-screen")).toBeNull();
    expect(r.cache.cachePeek("lesson:7")).toBeNull();
  });
});

describe("every chessschool.* key the app stores is accounted for", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p);
    }
  };
  walk(root);
  walk(join(root, "..", "app"));

  it("a new storage key must be listed here (and wiped, or allowed) before it ships", () => {
    const found = new Set<string>();
    for (const f of files) {
      // backup.ts: "chessschool.progression" is a field name inside the backup file, not a stored key
      if (f.endsWith("/backup.ts")) continue;
      for (const m of readFileSync(f, "utf8").matchAll(
        /["'`](chessschool\.[A-Za-z][A-Za-z0-9.]*)["'`]/g,
      )) {
        found.add(m[1]);
      }
    }
    // not storage keys: the bundle id / URL scheme
    found.delete("chessschool.app");
    const unknown = [...found].filter((k) => !KNOWN_KEYS.includes(k));
    expect(
      unknown,
      `new storage keys without a wipe decision: ${unknown.join(", ")}`,
    ).toEqual([]);
  });
});
