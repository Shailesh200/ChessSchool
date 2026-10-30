import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// bleed-a wiring: useLearnData is a React hook that cannot run in this environment, so the fence is
// pinned by reading the source (same approach as authWiring.test.ts). dataCache.test.ts tests the fence.
const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "useLearnData.ts"),
  "utf8",
);
const load = src.slice(
  src.indexOf("const load = useCallback"),
  src.indexOf("useEffect(() => {"),
);

describe("useLearnData: the cache write is fenced by the wipe generation", () => {
  it("reads the generation BEFORE the fetch starts", () => {
    const gen = load.indexOf("cacheGeneration()");
    const fetch = load.indexOf("fetchLearnBundle()");
    expect(gen).toBeGreaterThan(-1);
    expect(fetch).toBeGreaterThan(gen);
  });

  it("hands it to cacheSet and stops when the write was dropped", () => {
    expect(load).toMatch(/if \(!cacheSet\(CACHE_KEY, fresh, startedAt\)\) return;/);
    // the stale reply must not reach component state or trigger a progress fetch either
    expect(load.indexOf("cacheSet(")).toBeLessThan(load.indexOf("setData(fresh)"));
  });
});
