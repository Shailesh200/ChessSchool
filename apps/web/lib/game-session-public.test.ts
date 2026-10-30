import { describe, expect, it } from "vitest";
import { attachParticipantIds } from "./game-session-public";

describe("game-session-public", () => {
  it("only exposes the viewer's own seat user id", () => {
    const seats = {
      w: { seat: "w" as const, name: "White", rating: 900 },
      b: { seat: "b" as const, name: "Black", rating: 920 },
    };
    const session = {
      whiteUserId: "user-white",
      blackUserId: "user-black",
    };
    const whiteView = attachParticipantIds(seats, session, "user-white");
    expect(whiteView.w?.userId).toBe("user-white");
    expect(whiteView.b?.userId).toBeUndefined();
  });
});
