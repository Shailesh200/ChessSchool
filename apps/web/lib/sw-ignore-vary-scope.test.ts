// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * UI-W-017: the service worker's `ignoreVary` cache match is scoped to /_next/image
 * (which answers `Vary: Accept`) and never widened to other cache-then-network
 * requests. sw.js is executed in a vm with a recording `caches.match`.
 */
function loadSw() {
  const listeners: Record<string, (e: unknown) => void> = {};
  const matchCalls: Array<{ url: string; options: unknown }> = [];
  const self = {
    location: { origin: "https://app.test" },
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  const caches = {
    match: (req: { url: string } | string, options?: unknown) => {
      matchCalls.push({ url: typeof req === "string" ? req : req.url, options });
      return Promise.resolve(undefined);
    },
    open: () => Promise.reject(new Error("unused")),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
  };
  const fetched: string[] = [];
  const ctx = vm.createContext({
    self,
    caches,
    URL,
    Response,
    Promise,
    fetch: (req: { url: string }) => {
      fetched.push(req.url);
      return Promise.resolve(new Response("net"));
    },
    console,
  });
  vm.runInContext(readFileSync(resolve(__dirname, "../public/sw.js"), "utf8"), ctx);
  async function dispatch(path: string) {
    let responded: Promise<unknown> | null = null;
    const request = {
      url: `https://app.test${path}`,
      method: "GET",
      mode: "no-cors",
      headers: new Headers(),
    };
    listeners.fetch({
      request,
      respondWith: (p: Promise<unknown>) => {
        responded = p;
      },
      waitUntil: () => {},
    });
    if (responded) await responded;
    return { handled: responded !== null };
  }
  return { dispatch, matchCalls, fetched };
}

describe("service worker ignoreVary scope (UI-W-017)", () => {
  it("matches /_next/image requests with ignoreVary so the precached entry is found offline", async () => {
    const sw = loadSw();
    const r = await sw.dispatch(
      "/_next/image?url=%2Fmascots%2Fcody-happy-v2.png&w=384&q=75",
    );
    expect(r.handled).toBe(true);
    expect(sw.matchCalls).toHaveLength(1);
    expect(sw.matchCalls[0].options).toEqual({ ignoreVary: true });
  });

  it("does NOT use ignoreVary for any other cache-then-network request", async () => {
    const sw = loadSw();
    for (const path of [
      "/data/openings.json",
      "/misc/thing",
      "/_next/imagefoo",
      "/other/_next/image",
    ]) {
      const r = await sw.dispatch(path);
      expect(r.handled, path).toBe(true);
    }
    expect(sw.matchCalls).toHaveLength(4);
    for (const c of sw.matchCalls) {
      const opts = c.options as { ignoreVary?: boolean } | undefined;
      expect(opts?.ignoreVary, c.url).toBeFalsy();
    }
  });
});
