import { beforeEach, describe, expect, it } from "vitest";
import {
  legacyOwner,
  ownedBy,
  ownerOf,
  reconcileRows,
  rowOwnerNow,
  withoutOwner,
} from "@/core/sync/rowOwner";
import { useSession } from "@/core/store/session.store";
import { markSignedIn, setGuestOwner } from "@/core/sync/guestOwner";

const A = { id: "A", email: "a@x.test", name: "A", role: "student" };

beforeEach(() => {
  localStorage.clear();
  useSession.getState().setSession(false, null);
});

describe("rowOwnerNow", () => {
  it("is the signed-in user's id", () => {
    useSession.getState().setSession(true, A);
    expect(rowOwnerNow()).toBe("A");
  });
  it("is guest for a signed-out visitor with nothing kept", () => {
    expect(rowOwnerNow()).toBe("guest");
  });
  it("is the kept copy's owner after a session expiry", () => {
    setGuestOwner("A");
    expect(rowOwnerNow()).toBe("A");
  });
  it("is the last pulled user's marker on a cold start", () => {
    markSignedIn("A");
    expect(rowOwnerNow()).toBe("A");
  });
  it("matches nobody while the session is unresolved", () => {
    useSession.setState({ authed: null, user: null } as never);
    expect(rowOwnerNow()).toBe("?");
  });
});

describe("row filters", () => {
  it("an untagged row is the device's last user's", () => {
    markSignedIn("A");
    expect(legacyOwner()).toBe("A");
    expect(ownerOf({}, legacyOwner())).toBe("A");
    expect(ownedBy([{ id: "1" }, { id: "2", owner: "B" }], "A")).toEqual([{ id: "1" }]);
  });
  it("withoutOwner drops only the tag", () => {
    expect(withoutOwner({ id: "1", owner: "A", x: 1 })).toEqual({ id: "1", x: 1 });
  });
  it("reconcileRows keeps own and (when adopting) guest rows, retagged; drops the rest", () => {
    const rows = [
      { id: "1", owner: "B" },
      { id: "2", owner: "A" },
      { id: "3", owner: "guest" },
      { id: "4", owner: "?" },
      { id: "5" },
    ];
    const r = reconcileRows(rows, "B", false, "A");
    expect(r.keep).toEqual([{ id: "1", owner: "B" }]);
    expect(r.drop.map((x) => x.id)).toEqual(["2", "3", "4", "5"]);
    const adopt = reconcileRows(rows, "B", true, "guest");
    expect(adopt.keep.map((x) => x.id)).toEqual(["1", "3", "5"]);
    expect(adopt.keep.every((x) => x.owner === "B")).toBe(true);
  });
});
