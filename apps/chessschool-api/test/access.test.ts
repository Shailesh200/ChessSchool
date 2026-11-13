import { describe, expect, it } from "vitest";
import { PATH } from "@chessschool/design";
import { courseAccess, guestProgressOverreach, GUEST_CLASS_LIMIT } from "../src/access";

const days = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, "2026-11-03"]));

describe("courseAccess", () => {
  it("keeps a single current class and locks the rest", () => {
    const fresh = courseAccess({}, false, PATH);
    expect(fresh.path[0]).toMatchObject({ id: "meet", state: "current", playable: true });
    expect(fresh.path[1]).toMatchObject({ id: "board", state: "locked", lockedReason: "progress", playable: false });
    expect(fresh.path.filter((n) => n.state === "current")).toHaveLength(1);
    expect(fresh.guestLimitReached).toBe(false);

    const afterMeet = courseAccess(days(["meet"]), false, PATH);
    expect(afterMeet.path[0].state).toBe("done");
    expect(afterMeet.path[1]).toMatchObject({ id: "board", state: "current" });
    expect(afterMeet.path[2].state).toBe("locked");
  });

  it("is unchanged when the same completion is reported again", () => {
    const once = courseAccess(days(["meet", "board"]), false, PATH);
    const twice = courseAccess(days(["meet", "board"]), false, PATH);
    expect(twice).toEqual(once);
    expect(twice.path.find((n) => n.id === "moves")?.state).toBe("current");
  });

  it("caps a guest at three classes", () => {
    const fresh = courseAccess({}, true, PATH);
    expect(fresh.path.filter((n) => n.playable).map((n) => n.id)).toEqual(PATH.slice(0, GUEST_CLASS_LIMIT).map((n) => n.id));
    expect(fresh.path[GUEST_CLASS_LIMIT]).toMatchObject({ id: "pawns", lockedReason: "guest", playable: false });
    expect(fresh.guestLimitReached).toBe(false);

    const used = courseAccess(days(["meet", "board", "moves"]), true, PATH);
    expect(used.guestLimitReached).toBe(true);
    expect(used.path.find((n) => n.state === "current")).toBeUndefined();
    expect(used.path.find((n) => n.id === "pawns")).toMatchObject({ state: "locked", lockedReason: "guest" });
    expect(guestProgressOverreach(days(["meet", "board", "moves", "pawns"]), PATH)).toBe(true);
    expect(guestProgressOverreach(days(["meet", "board", "moves"]), PATH)).toBe(false);
  });
});
