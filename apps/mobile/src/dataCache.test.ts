import { describe, expect, it, vi } from "vitest";

// bleed-a: a fetch that started before a wipe must not put the old user's reply back into the
// cache. wipeUserData() runs cacheClear(), which bumps the generation cacheSet() checks.

async function fresh() {
  vi.resetModules();
  return import("./dataCache");
}

describe("dataCache generation fence", () => {
  it("a normal fetch still caches (generation unchanged)", async () => {
    const c = await fresh();
    const startedAt = c.cacheGeneration();
    expect(c.cacheSet("learn-screen", { who: "A" }, startedAt)).toBe(true);
    expect(c.cachePeek("learn-screen")).toEqual({ who: "A" });
  });

  it("a fetch that resolves after a wipe writes nothing", async () => {
    const c = await fresh();
    const startedAt = c.cacheGeneration(); // fetch starts as A
    c.cacheClear(); // logout / 401 / delete wipes
    expect(c.cacheSet("learn-screen", { who: "A" }, startedAt)).toBe(false); // A's reply lands late
    expect(c.cachePeek("learn-screen")).toBeNull();
    expect(c.cacheGet("learn-screen", 60_000)).toBeNull();
  });

  it("a fetch that starts after the wipe (the next user) caches normally", async () => {
    const c = await fresh();
    c.cacheClear();
    expect(c.cacheSet("learn-screen", { who: "B" }, c.cacheGeneration())).toBe(true);
    expect(c.cachePeek("learn-screen")).toEqual({ who: "B" });
  });

  it("every wipe bumps the generation, so two wipes in a row still fence an old fetch", async () => {
    const c = await fresh();
    const startedAt = c.cacheGeneration();
    c.cacheClear();
    c.cacheClear();
    expect(c.cacheSet("k", 1, startedAt)).toBe(false);
  });
});
