import { describe, expect, it } from "vitest";
import { applyAuth, applySignOut, guestPayload } from "./session";
import { completeNode, createInitialState, emptyProgress } from "./progress";

describe("guest -> account handoff", () => {
  const guest = () => {
    const s = completeNode(createInitialState("g-1"), "meet", new Date("2026-11-03T10:00:00"));
    return { ...s, profile: { ...s.profile, name: "Asha", dailyMinutes: 15 as const } };
  };

  it("sends the guest's profile and progress", () => {
    const p = guestPayload(guest());
    expect(p.guestId).toBe("g-1");
    expect(p.profile?.name).toBe("Asha");
    expect(p.progress?.completed.meet).toBe("2026-11-03");
  });

  it("keeps orientation after signup even if the server copy is empty", () => {
    const s = applyAuth(guest(), {
      user: { id: "u1", email: "a@b.co", name: "Asha", provider: "password" },
      profile: { name: "Asha", who: null, dailyMinutes: 15, appearance: "dark", sound: false, avatar: "cody", flair: null },
      progress: emptyProgress(),
    });
    expect(s.account?.id).toBe("u1");
    expect(s.progress.completed.meet).toBe("2026-11-03");
    expect(s.progress.xp).toBe(10);
    expect(s.prefs.appearance).toBe("dark");
    expect(s.pendingCeremony).toBe("saved");
    expect(s.seenWelcome).toBe(true);
  });

  it("sign out forgets the account but not this device's progress", () => {
    const signedIn = applyAuth(guest(), {
      user: { id: "u1", email: "a@b.co", name: "Asha", provider: "password" },
      profile: { name: "Asha", who: null, dailyMinutes: 15, appearance: "system", sound: true, avatar: "cody", flair: null },
      progress: emptyProgress(),
    });
    const out = applySignOut(signedIn);
    expect(out.account).toBeNull();
    expect(out.progress.completed.meet).toBeDefined();
  });
});
