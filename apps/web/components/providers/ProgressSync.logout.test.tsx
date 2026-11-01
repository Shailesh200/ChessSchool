import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ProgressSync sends the debounced snapshot and adopts the reply. Two races in
// the time the POST is in flight: the user logs out (the reply is the old user's),
// or the user edits a field (the edit must survive and go out with the next push).

vi.mock("@/core/bootstrap/storeBootstrap", () => ({
  rehydrateAllStores: async () => undefined,
}));
vi.mock("@/core/store/toast.store", () => ({ toast: vi.fn() }));
vi.mock("@/core/sync/pullProgress", async () => {
  const progression = await import("@/core/store/progression.store");
  const plan = await import("@/core/store/plan.store");
  return {
    pullProgress: async () => ({
      id: "u1",
      email: "a@b.c",
      name: "A",
      role: "student",
    }),
    fullSnapshotAsync: async () => ({
      ...progression.progressSnapshot(progression.useProgression.getState()),
      homeworkStreak: plan.usePlan.getState().homeworkStreak,
      homeworkLastDay: plan.usePlan.getState().homeworkLastDay,
    }),
  };
});

import { ProgressSync } from "@/components/providers/ProgressSync";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";

type Flight = {
  body: { rating?: number; streak?: number };
  reply: (b: unknown) => void;
};
let flights: Flight[];

const ack = {
  ok: true,
  count: 1,
  streak: 5,
  lastActiveDay: "2026-10-29",
  rating: 1400,
  ratingUpdatedAt: 5_000,
  homeworkStreak: 3,
  homeworkLastDay: "2026-10-29",
};

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function mountSignedIn() {
  const view = render(<ProgressSync />);
  await settle();
  await settle();
  return view;
}

async function firePush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  flights = [];
  useProgression.getState().reset();
  usePlan.setState({ homeworkStreak: 0, homeworkLastDay: null });
  useSession
    .getState()
    .setSession(true, { id: "u1", email: "a@b.c", name: "A", role: "student" });
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: { body?: string }) => {
      return new Promise((resolve) => {
        flights.push({
          body: JSON.parse(init?.body ?? "{}"),
          reply: (b) => resolve({ ok: true, json: async () => b }),
        });
      });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ProgressSync reply vs logout / edits in flight", () => {
  it("adopts the reply when nothing happened during the flight (control)", async () => {
    await mountSignedIn();
    act(() => useProgression.setState({ xp: 10 }));
    await firePush();
    expect(flights).toHaveLength(1);
    await act(async () => {
      flights[0].reply(ack);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(useProgression.getState().streak).toBe(5);
    expect(useProgression.getState().rating).toBe(1400);
    expect(usePlan.getState().homeworkStreak).toBe(3);
  });

  it("drops the reply when the store was wiped (logout) during the flight", async () => {
    const view = await mountSignedIn();
    act(() => useProgression.setState({ xp: 10 }));
    await firePush();
    expect(flights).toHaveLength(1);

    // logout, the same steps LogoutButton takes
    act(() => {
      useProgression.getState().reset();
      usePlan.setState({ homeworkStreak: 0, homeworkLastDay: null });
      useSession.getState().setSession(false, null);
    });
    view.unmount(); // the page unmounts on /login; no further push is wanted here
    await act(async () => {
      flights[0].reply(ack);
      await vi.advanceTimersByTimeAsync(0);
    });

    const s = useProgression.getState();
    expect(s.streak).toBe(0);
    expect(s.lastActiveDay ?? null).toBeNull();
    expect(s.rating).toBe(800);
    expect(usePlan.getState().homeworkStreak).toBe(0);
  });

  it("drops the reply of the first (guest merge) push when logged out during the flight", async () => {
    act(() => useProgression.setState({ xp: 40 })); // guest progress to merge into the account
    const view = await mountSignedIn();
    expect(flights).toHaveLength(1);

    act(() => {
      useProgression.getState().reset();
      useSession.getState().setSession(false, null);
    });
    view.unmount();
    await act(async () => {
      flights[0].reply(ack);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(useProgression.getState().streak).toBe(0);
    expect(useProgression.getState().rating).toBe(800);
  });

  it("keeps a field edited during the flight and sends it with the next push", async () => {
    await mountSignedIn();
    act(() => useProgression.setState({ xp: 10 }));
    await firePush();
    expect(flights).toHaveLength(1);

    // the player finishes a game while the first POST is in flight
    act(() => useProgression.setState({ rating: 900, ratingUpdatedAt: 123 }));
    await act(async () => {
      flights[0].reply(ack);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(useProgression.getState().rating).toBe(900); // not overwritten by 1400
    expect(useProgression.getState().streak).toBe(5); // untouched groups still adopt

    await firePush();
    expect(flights).toHaveLength(2);
    expect(flights[1].body.rating).toBe(900); // the edit goes out on the next push
  });
});
