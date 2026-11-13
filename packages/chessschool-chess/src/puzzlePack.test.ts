import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_PACK } from "./puzzles.fallback";
import { allPuzzles, dailyPuzzle, getPuzzlePackStatus, getPuzzlePackVersion, lockDailyPuzzle, nextPuzzle, packReady, selectDailyPuzzle, setPuzzlePack, setPuzzlePackStatus, type PuzzlePack } from "./puzzles";
import { PUZZLE_PACK_KEY, refreshPuzzlePack, type PuzzlePackFetch, type PuzzlePackStorage } from "./puzzlePack";

const pack = (version: string, id: string, theme: "fork" | "pin" = "fork"): PuzzlePack => ({
  version,
  puzzles: [{ id, fen: "7k/6pp/8/8/8/n7/Q7/6RK b - - 0 1", moves: ["a3b1", "a2a8"], rating: 900, themes: [theme] }],
});

function memory(initial?: string): PuzzlePackStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial !== undefined) raw.set(PUZZLE_PACK_KEY, initial);
  return {
    raw,
    getItem: async (key) => raw.get(key) ?? null,
    setItem: async (key, value) => {
      raw.set(key, value);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  setPuzzlePack(FALLBACK_PACK);
  setPuzzlePackStatus("loading");
  lockDailyPuzzle("", null);
});

describe("puzzle pack refresh", () => {
  it("installs the cache, sends its stored ETag, then replaces it on 200", async () => {
    const storage = memory(JSON.stringify({ ...pack("v1", "cache1"), etag: '"v1-1-aaa"' }));
    const fetch = vi.fn<PuzzlePackFetch>(async (_url, init) => {
      expect(init.headers["If-None-Match"]).toBe('"v1-1-aaa"');
      expect(getPuzzlePackVersion()).toBe("v1");
      return { status: 200, json: async () => pack("v2", "next01"), etag: '"v2-1-bbb"' };
    });
    await refreshPuzzlePack({ storage, fetch, apiBase: "http://api.test", source: "api" });
    expect(fetch).toHaveBeenCalledOnce();
    expect(getPuzzlePackVersion()).toBe("v2");
    const saved = JSON.parse(storage.raw.get(PUZZLE_PACK_KEY)!);
    expect(saved.version).toBe("v2");
    expect(saved.etag).toBe('"v2-1-bbb"');
  });

  it("replaces a pack cached part-way through a seed with the full pack of the same version", async () => {
    const many = (n: number): PuzzlePack => ({
      version: "own-2026.11.13-s20261113",
      puzzles: Array.from({ length: n }, (_, i) => ({ ...pack("x", `p${i}`).puzzles[0]!, id: `p${String(i).padStart(4, "0")}` })),
    });
    const storage = memory(JSON.stringify(many(278)));
    const fetch = vi.fn<PuzzlePackFetch>(async (_url, init) => {
      expect(init.headers["If-None-Match"]).toBeUndefined();
      return { status: 200, json: async () => many(570), etag: '"own-2026.11.13-s20261113-570-abc"' };
    });
    await refreshPuzzlePack({ storage, fetch, apiBase: "http://api.test", source: "api" });
    expect(allPuzzles()).toHaveLength(570);
    expect(JSON.parse(storage.raw.get(PUZZLE_PACK_KEY)!).puzzles).toHaveLength(570);

    const again = vi.fn<PuzzlePackFetch>(async (_url, init) => {
      expect(init.headers["If-None-Match"]).toBe('"own-2026.11.13-s20261113-570-abc"');
      return { status: 304, json: async () => { throw new Error("no body"); } };
    });
    await refreshPuzzlePack({ storage, fetch: again, apiBase: "http://api.test", source: "api" });
    expect(allPuzzles()).toHaveLength(570);
  });

  it("keeps the cached pack on 304", async () => {
    const storage = memory(JSON.stringify(pack("v1", "cache1")));
    const fetch = vi.fn<PuzzlePackFetch>(async () => ({ status: 304, json: async () => { throw new Error("no body"); } }));
    await refreshPuzzlePack({ storage, fetch, apiBase: "http://api.test/", source: "api" });
    expect(getPuzzlePackVersion()).toBe("v1");
    expect(storage.raw.get(PUZZLE_PACK_KEY)).toContain("v1");
  });

  it("keeps the fallback when the pack is not seeded", async () => {
    const fetch = vi.fn<PuzzlePackFetch>(async () => ({ status: 404, json: async () => ({ error: "not_found" }) }));
    await refreshPuzzlePack({ storage: memory(), fetch, apiBase: "", source: "api" });
    expect(getPuzzlePackVersion()).toBe(FALLBACK_PACK.version);
    expect(fetch).toHaveBeenCalledWith("/v1/puzzles/pack", { headers: {} });
  });

  it("ignores an invalid body and a network error", async () => {
    const storage = memory(JSON.stringify(pack("v1", "cache1")));
    const bad = vi.fn<PuzzlePackFetch>(async () => ({ status: 200, json: async () => ({ version: "nope", puzzles: [{ id: 1 }] }) }));
    await refreshPuzzlePack({ storage, fetch: bad, apiBase: "http://api.test", source: "api" });
    expect(getPuzzlePackVersion()).toBe("v1");

    const down = vi.fn<PuzzlePackFetch>(async () => { throw new Error("offline"); });
    await refreshPuzzlePack({ storage, fetch: down, apiBase: "http://api.test", source: "api" });
    expect(getPuzzlePackVersion()).toBe("v1");
  });

  it("does not fetch in bundled mode", async () => {
    const fetch = vi.fn<PuzzlePackFetch>(async () => ({ status: 200, json: async () => pack("v9", "nope01") }));
    const pending = refreshPuzzlePack({ storage: memory(JSON.stringify(pack("v1", "cache1"))), fetch, apiBase: "http://api.test", source: "bundled" });
    expect(packReady()).toBe(true);
    expect(getPuzzlePackStatus()).toBe("fallback");
    expect(fetch).not.toHaveBeenCalled();
    await pending;
    expect(fetch).not.toHaveBeenCalled();
    expect(getPuzzlePackVersion()).toBe(FALLBACK_PACK.version);
  });

  it("keeps the daily served from the cache when a later pack arrives", async () => {
    const cached = pack("v1", "cache1", "pin");
    const replacement = pack("v3", "api009", "pin");
    let release: (res: { status: number; json: () => Promise<unknown> }) => void = () => {};
    const fetch = vi.fn<PuzzlePackFetch>(() => new Promise((resolve) => { release = resolve; }));
    const raw = new Map<string, string>([[PUZZLE_PACK_KEY, JSON.stringify(cached)]]);
    const pending = refreshPuzzlePack({
      storage: { getItem: (key) => raw.get(key) ?? null, setItem: async (key, value) => { raw.set(key, value); } },
      fetch,
      apiBase: "http://api.test",
      source: "api",
    });
    expect(getPuzzlePackStatus()).toBe("cache");
    const first = selectDailyPuzzle({ day: "2026-11-13", completedThemes: ["pin"], seenIds: [] });
    expect(first.persist).toBe(true);
    expect(first.puzzle?.id).toBe("cache1");
    lockDailyPuzzle("2026-11-13", first.puzzle!);
    release({ status: 200, json: async () => ({ version: "v2", puzzles: [cached.puzzles[0], replacement.puzzles[0]] }) });
    await pending;
    expect(getPuzzlePackVersion()).toBe("v2");
    const sameDay = selectDailyPuzzle({ day: "2026-11-13", completedThemes: ["pin"], seenIds: ["cache1"], servedDay: "2026-11-13", servedId: "cache1" });
    expect(sameDay.persist).toBe(false);
    expect(sameDay.puzzle?.id).toBe("cache1");
    setPuzzlePack(replacement);
    lockDailyPuzzle("", null);
    const fromStored = selectDailyPuzzle({ day: "2026-11-13", completedThemes: ["pin"], seenIds: ["cache1"], servedDay: "2026-11-13", servedId: "cache1", stored: first.puzzle });
    expect(fromStored.persist).toBe(false);
    expect(fromStored.puzzle?.id).toBe("cache1");
  });

  it("persists nothing while the pack is loading", () => {
    expect(getPuzzlePackStatus()).toBe("loading");
    const saved: string[] = [];
    const choice = selectDailyPuzzle({ day: "2026-11-13", completedThemes: ["fork"], seenIds: [] });
    if (choice.persist && choice.puzzle) saved.push(choice.puzzle.id);
    expect(choice).toEqual({ puzzle: null, persist: false });
    expect(saved).toEqual([]);
    expect(packReady()).toBe(false);
  });

  it("falls back when offline with no cache, then allows a persist", async () => {
    vi.useFakeTimers();
    let rejectFetch: (err: Error) => void = () => {};
    const fetch = vi.fn<PuzzlePackFetch>(() => new Promise((_, reject) => { rejectFetch = reject; }));
    const pending = refreshPuzzlePack({
      storage: { getItem: () => null, setItem: async () => {} },
      fetch,
      apiBase: "http://api.test",
      source: "api",
    });
    expect(getPuzzlePackStatus()).toBe("loading");
    expect(selectDailyPuzzle({ day: "2026-11-13" }).persist).toBe(false);
    await vi.advanceTimersByTimeAsync(2999);
    expect(getPuzzlePackStatus()).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);
    expect(getPuzzlePackStatus()).toBe("fallback");
    expect(packReady()).toBe(true);
    const choice = selectDailyPuzzle({ day: "2026-11-13", completedThemes: [], seenIds: [] });
    const saved: string[] = [];
    if (choice.persist && choice.puzzle) saved.push(choice.puzzle.id);
    expect(choice.persist).toBe(true);
    expect(choice.puzzle?.id).toBeTruthy();
    expect(saved).toEqual([choice.puzzle?.id]);
    rejectFetch(new Error("offline"));
    await pending;
  });

  it("loads the full own pack into the store without fetching", async () => {
    const fetch = vi.fn<PuzzlePackFetch>(async () => ({ status: 200, json: async () => pack("v9", "nope01") }));
    const { OWN_PACK } = await import("./ownPuzzlePack");
    expect(OWN_PACK.puzzles.length).toBeGreaterThan(500);
    expect(FALLBACK_PACK.puzzles.length).toBe(100);
    expect(OWN_PACK.version).toBe(FALLBACK_PACK.version);
    const onlyFull = OWN_PACK.puzzles.find((p) => !FALLBACK_PACK.puzzles.some((f) => f.id === p.id));
    expect(onlyFull).toBeTruthy();
    setPuzzlePack(OWN_PACK);
    setPuzzlePackStatus("fallback");
    expect(packReady()).toBe(true);
    expect(allPuzzles().some((p) => p.id === onlyFull!.id)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    const pending = refreshPuzzlePack({ storage: memory(), fetch, apiBase: "http://api.test", source: "bundled" });
    expect(fetch).not.toHaveBeenCalled();
    await pending;
    expect(fetch).not.toHaveBeenCalled();
    expect(getPuzzlePackStatus()).toBe("fallback");
  });

  it("serves daily and next puzzles from the installed pack", () => {
    setPuzzlePack({
      version: "test",
      puzzles: [
        { id: "fork01", fen: "r3k3/8/8/1N6/8/p7/8/4K3 b - - 0 1", moves: ["a3a2", "b5c7"], rating: 900, themes: ["fork"] },
        { id: "pin001", fen: "4k3/8/2b5/8/8/8/4R3/4K3 b - - 0 1", moves: ["c6e4", "e2e4"], rating: 880, themes: ["pin"] },
      ],
    });
    expect(nextPuzzle({ rating: 900, theme: "pin", rand: () => 0 }).id).toBe("pin001");
    expect(dailyPuzzle("2026-11-13", ["pin"], []).id).toBe("pin001");
    expect(dailyPuzzle("2026-11-13", ["pin"], []).id).toBe(dailyPuzzle("2026-11-13", ["pin"], []).id);
  });
});
