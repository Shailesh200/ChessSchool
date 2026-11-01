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

import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
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
});
