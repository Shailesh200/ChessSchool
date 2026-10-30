import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// An explicit logout wipes the stores and leaves no owner tag behind: a stale tag from a
// session expiry must not make the next sign-in (the same user or another) drop a plain
// guest's progress, and nothing of the user stays on the device.

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn(async () => undefined) }));
vi.mock("@/lib/pulse", () => ({ pulseTrack: vi.fn() }));
vi.mock("@/core/pwa/clearRuntimeCaches", () => ({
  clearRuntimeCaches: async () => undefined,
}));
const dexie = vi.hoisted(() => ({
  clearLocalRows: vi.fn(async () => undefined as void),
}));
vi.mock("@/core/db/db", () => ({ clearLocalRows: dexie.clearLocalRows }));

import { LogoutButton } from "@/components/account/LogoutButton";
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
});

describe("LogoutButton", () => {
  it("wipes the progress and clears the guest-owner tag (Arc's case 3: nothing is left behind)", async () => {
    useProgression.setState({ xp: 640 });
    setGuestOwner("A"); // left by an earlier session expiry
    markSignedIn("A"); // left by a successful pull
    const view = render(<LogoutButton />);
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(getGuestOwner()).toBeNull();
    expect(getSignedInMarker()).toBeNull();
    expect(useProgression.getState().xp).toBe(0);
    expect(useSession.getState().authed).toBe(false);
  });

  it("clears the local journal, games and reviews (bleed P0) and the match, arena and settings (DP-W-001)", async () => {
    useMatch.setState({ active: { id: "g1", mode: "bot" } as unknown as ActiveMatch });
    useArena.setState({ active: { id: "run1" } as never });
    useSettings.getState().set("targetElo", 1400);
    useSettings.setState({ highContrast: true });
    usePlan.setState({ homeworkStreak: 4 });
    const view = render(<LogoutButton />);
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
    const view = render(<LogoutButton />);
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(useSession.getState().authed).toBe(false);
  });
});
