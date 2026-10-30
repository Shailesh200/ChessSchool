import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Deleting the account is an explicit sign-out too: nothing of the user, not even the
// guest-owner tag a session expiry left, stays on the device.

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/pulse", () => ({ pulseTrack: vi.fn() }));
vi.mock("@/core/pwa/clearRuntimeCaches", () => ({
  clearRuntimeCaches: async () => undefined,
}));
const dexie = vi.hoisted(() => ({
  clearLocalRows: vi.fn(async () => undefined as void),
}));
vi.mock("@/core/db/db", () => ({ clearLocalRows: dexie.clearLocalRows }));

import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import {
  getGuestOwner,
  getSignedInMarker,
  markSignedIn,
  setGuestOwner,
} from "@/core/sync/guestOwner";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useMatch, type ActiveMatch } from "@/core/store/match.store";
import { useArena } from "@/core/store/arena.store";
import { useSettings } from "@/core/store/settings.store";
import { usePlan } from "@/core/store/plan.store";

beforeEach(() => {
  localStorage.clear();
  replace.mockClear();
  dexie.clearLocalRows.mockReset();
  dexie.clearLocalRows.mockResolvedValue(undefined);
  useProgression.getState().reset();
  useSession
    .getState()
    .setSession(true, { id: "A", email: "a@x.test", name: "A", role: "student" });
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("DeleteAccountButton", () => {
  it("wipes the progress and clears the guest-owner tag", async () => {
    useProgression.setState({ xp: 640 });
    setGuestOwner("A");
    markSignedIn("A");
    const view = render(<DeleteAccountButton />);
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(getGuestOwner()).toBeNull();
    expect(getSignedInMarker()).toBeNull();
    expect(useProgression.getState().xp).toBe(0);
    expect(useSession.getState().authed).toBe(false);
  });

  it("keeps the tag when the server refuses the deletion", async () => {
    setGuestOwner("A");
    markSignedIn("A");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    const view = render(<DeleteAccountButton />);
    fireEvent.click(view.getByRole("button"));
    await waitFor(() =>
      expect(view.getByText(/Request failed|Could not/)).toBeTruthy(),
    );
    expect(getGuestOwner()).toBe("A");
    expect(getSignedInMarker()).toBe("A");
    expect(replace).not.toHaveBeenCalled();
  });

  it("clears the local journal, games and reviews (bleed P0) and the match, arena and settings (DP-W-001)", async () => {
    useMatch.setState({ active: { id: "g1", mode: "bot" } as unknown as ActiveMatch });
    useArena.setState({ active: { id: "run1" } as never });
    useSettings.getState().set("targetElo", 1400);
    useSettings.setState({ highContrast: true });
    usePlan.setState({ homeworkStreak: 4 });
    const view = render(<DeleteAccountButton />);
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(dexie.clearLocalRows).toHaveBeenCalledTimes(1);
    expect(useMatch.getState().active).toBeNull();
    expect(useArena.getState().active).toBeNull();
    expect(useSettings.getState().targetElo).not.toBe(1400);
    expect(useSettings.getState().highContrast).toBe(false);
    expect(usePlan.getState().homeworkStreak).toBe(0);
  });

  it("still signs out when the local database cannot be cleared", async () => {
    dexie.clearLocalRows.mockRejectedValue(new Error("idb unavailable"));
    const view = render(<DeleteAccountButton />);
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(useSession.getState().authed).toBe(false);
  });
});
