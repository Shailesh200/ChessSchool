import { describe, expect, it } from "vitest";
import { completeNode, createInitialState } from "./progress";
import { forgetProfile, freshSlice, switchProfile } from "./profiles";

describe("child profiles on one device", () => {
  it("parks the account's learner, starts the child fresh, and switches back without mixing progress", () => {
    let s = completeNode(createInitialState("g"), "board", new Date("2026-11-14T10:00:00"));
    s = { ...s, prefs: { ...s.prefs, coach: "meera" } };
    const parentXp = s.progress.xp;
    s = switchProfile(s, "kid1", freshSlice(s, "Riya", "kira"));
    expect(s.activeChild).toBe("kid1");
    expect(s.profile.name).toBe("Riya");
    expect(s.progress.xp).toBe(0);
    expect(s.prefs.coach).toBeNull();
    s = completeNode(s, "meet", new Date("2026-11-14T11:00:00"));
    s = switchProfile(s, null);
    expect(s.activeChild).toBeNull();
    expect(s.progress.xp).toBe(parentXp);
    expect(s.prefs.coach).toBe("meera");
    s = switchProfile(s, "kid1");
    expect(Object.keys(s.progress.completed)).toEqual(["meet"]);
    s = forgetProfile(s, "kid1");
    expect(s.activeChild).toBeNull();
    expect(s.parked.kid1).toBeUndefined();
    expect(s.progress.xp).toBe(parentXp);
  });

  it("fills fields a child slice parked by an older app version lacks", () => {
    const s = createInitialState("g");
    const { mistakes: _m, ratings: _r, ...old } = freshSlice(s, "Riya", "kira");
    const next = switchProfile({ ...s, parked: { kid1: old as never } }, "kid1");
    expect(next.ratings).toBeDefined();
    expect(next.mistakes).toEqual([]);
  });
});
