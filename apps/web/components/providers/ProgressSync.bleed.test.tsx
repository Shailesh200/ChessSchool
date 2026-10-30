import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DP-W-002 (a 401 on a push resets nothing) and the bleed push race (the rows are read
// from Dexie after the timer fires: a logout or user switch in that window must send nothing).

const ctl = vi.hoisted(() => ({
  expired: undefined as unknown as ReturnType<typeof import("vitest").vi.fn>,
  gate: null as null | Promise<void>,
}));
vi.mock("@/core/bootstrap/storeBootstrap", () => ({
  rehydrateAllStores: async () => undefined,
}));
vi.mock("@/core/store/toast.store", () => ({ toast: vi.fn() }));
vi.mock("@/core/sync/pullProgress", async () => {
  const progression = await import("@/core/store/progression.store");
  const { vi } = await import("vitest");
  ctl.expired = vi.fn();
  return {
    pullProgress: async () => ({
      id: "A",
      email: "a@x.test",
      name: "A",
      role: "student",
    }),
    handleSessionExpired: ctl.expired,
    fullSnapshotAsync: async () => {
      const snap = progression.progressSnapshot(progression.useProgression.getState());
      if (ctl.gate) await ctl.gate;
      return snap;
    },
  };
});

import { ProgressSync } from "@/components/providers/ProgressSync";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";

const A = { id: "A", email: "a@x.test", name: "A", role: "student" };
const B = { id: "B", email: "b@x.test", name: "B", role: "student" };
type Flight = { reply: (status: number) => void };
let flights: Flight[];

const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const firePush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });

beforeEach(() => {
  vi.useFakeTimers();
  flights = [];
  ctl.gate = null;
  ctl.expired.mockClear();
  useProgression.getState().reset();
  useSession.getState().setSession(true, A);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          flights.push({
            reply: (status) =>
              resolve({ ok: status < 300, status, json: async () => ({ ok: true }) }),
          });
        }),
    ),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mount() {
  const view = render(<ProgressSync />);
  await settle();
  await settle();
  return view;
}

describe("a 401 on a push is a session expiry (DP-W-002)", () => {
  it("debounced push", async () => {
    await mount();
    act(() => useProgression.setState({ xp: 10 }));
    await firePush();
    expect(flights).toHaveLength(1);
    await act(async () => {
      flights[0].reply(401);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ctl.expired).toHaveBeenCalledTimes(1);
  });

  it("first (guest merge) push", async () => {
    act(() => useProgression.setState({ xp: 40 }));
    await mount();
    expect(flights).toHaveLength(1);
    await act(async () => {
      flights[0].reply(401);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ctl.expired).toHaveBeenCalledTimes(1);
  });

  it("a 500 is not an expiry", async () => {
    await mount();
    act(() => useProgression.setState({ xp: 10 }));
    await firePush();
    await act(async () => {
      flights[0].reply(500);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ctl.expired).not.toHaveBeenCalled();
  });

  it("a 401 for a reply that arrives after a logout is ignored", async () => {
    const view = await mount();
    act(() => useProgression.setState({ xp: 10 }));
    await firePush();
    act(() => {
      useProgression.getState().reset();
      useSession.getState().setSession(false, null);
    });
    view.unmount();
    await act(async () => {
      flights[0].reply(401);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ctl.expired).not.toHaveBeenCalled();
  });
});

describe("rows read for a push after a logout / user switch are not sent", () => {
  async function pushWhileReading(change: () => void) {
    await mount();
    let release!: () => void;
    ctl.gate = new Promise<void>((r) => (release = r));
    act(() => useProgression.setState({ xp: 10 }));
    await firePush(); // the timer fired and is now reading the rows
    act(change);
    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(0);
    });
    await firePush();
  }

  it("control: no change, the push goes out", async () => {
    await pushWhileReading(() => undefined);
    expect(flights).toHaveLength(1);
  });

  it("logout while the rows are read: nothing is sent", async () => {
    await pushWhileReading(() => {
      useProgression.getState().reset();
      useSession.getState().setSession(false, null);
    });
    expect(flights).toHaveLength(0);
  });

  it("another user signs in while the rows are read: nothing is sent", async () => {
    await pushWhileReading(() => useSession.getState().setSession(true, B));
    expect(flights).toHaveLength(0);
  });
});

describe("the first push (guest progress merged into the account) reads the rows too", () => {
  async function firstPushWhileReading(change: () => void) {
    act(() => useProgression.setState({ xp: 40 })); // guest progress present at mount
    let release!: () => void;
    ctl.gate = new Promise<void>((r) => (release = r));
    await mount(); // pull done, the first push is reading the rows
    act(change);
    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it("control: no change, the first push goes out", async () => {
    await firstPushWhileReading(() => undefined);
    expect(flights).toHaveLength(1);
  });

  it("logout while the rows are read: nothing is sent", async () => {
    await firstPushWhileReading(() => {
      useProgression.getState().reset();
      useSession.getState().setSession(false, null);
    });
    expect(flights).toHaveLength(0);
  });

  it("another user signs in while the rows are read: nothing is sent", async () => {
    await firstPushWhileReading(() => useSession.getState().setSession(true, B));
    expect(flights).toHaveLength(0);
  });
});
