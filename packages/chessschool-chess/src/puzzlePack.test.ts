import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_PACK } from "./puzzles.fallback";
import { dailyPuzzle, getPuzzlePackVersion, nextPuzzle, setPuzzlePack, type PuzzlePack } from "./puzzles";
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
  setPuzzlePack(FALLBACK_PACK);
});

describe("puzzle pack refresh", () => {
  it("installs the cache, then replaces it on 200", async () => {
    const storage = memory(JSON.stringify(pack("v1", "cache1")));
    const fetch = vi.fn<PuzzlePackFetch>(async (_url, init) => {
      expect(init.headers["If-None-Match"]).toBe('"v1"');
      expect(getPuzzlePackVersion()).toBe("v1");
      return { status: 200, json: async () => pack("v2", "next01") };
    });
    await refreshPuzzlePack({ storage, fetch, apiBase: "http://api.test", source: "api" });
    expect(fetch).toHaveBeenCalledOnce();
    expect(getPuzzlePackVersion()).toBe("v2");
    expect(JSON.parse(storage.raw.get(PUZZLE_PACK_KEY)!).version).toBe("v2");
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
    await refreshPuzzlePack({ storage: memory(JSON.stringify(pack("v1", "cache1"))), fetch, apiBase: "http://api.test", source: "bundled" });
    expect(fetch).not.toHaveBeenCalled();
    expect(getPuzzlePackVersion()).toBe(FALLBACK_PACK.version);
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
