import { describe, expect, it } from "vitest";
import { createApiWatch } from "./connectivity";

const noSleep = () => Promise.resolve();

describe("api watch", () => {
  it("stays up when a probe fails once and the retry answers", async () => {
    let n = 0;
    const w = createApiWatch({ probe: async () => (++n === 1 ? Promise.reject(new Error("cold")) : true), sleep: noSleep });
    expect(await w.check()).toBe(true);
    expect(w.up()).toBe(true);
    expect(n).toBe(2);
  });

  it("is down only after every attempt failed, re-checks on its own and comes back on any answer", async () => {
    const timers: (() => void)[] = [];
    let ok = false;
    let probes = 0;
    const w = createApiWatch({ probe: async () => (probes++, ok ? true : Promise.reject(new Error("down"))), sleep: noSleep, setTimer: (fn) => timers.push(fn), clearTimer: () => {} });
    const seen: boolean[] = [];
    w.subscribe(() => seen.push(w.up()));
    expect(await w.check()).toBe(false);
    expect(probes).toBe(3);
    expect(w.up()).toBe(false);
    expect(timers).toHaveLength(1);
    w.reportOk();
    expect(w.up()).toBe(true);
    expect(seen).toEqual([false, true]);
  });

  it("joins a probe already running instead of starting another", async () => {
    let probes = 0;
    const w = createApiWatch({ probe: async () => (probes++, true), sleep: noSleep });
    await Promise.all([w.check(), w.check(), w.check()]);
    expect(probes).toBe(1);
  });
});
