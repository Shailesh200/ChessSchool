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

import { LogoutButton } from "@/components/account/LogoutButton";
import {
  getGuestOwner,
  getSignedInMarker,
  markSignedIn,
  setGuestOwner,
} from "@/core/sync/guestOwner";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";

beforeEach(() => {
  localStorage.clear();
  replace.mockClear();
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
});
