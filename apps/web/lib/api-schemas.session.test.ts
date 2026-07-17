import { describe, expect, it } from "vitest";
import { progressPushSchema, sessionPostSchema } from "@/lib/api-schemas";

describe("sessionPostSchema", () => {
  it("accepts a valid move", () => {
    const parsed = sessionPostSchema.safeParse({
      action: "move",
      seatToken: "abc.def.ghi",
      from: "e2",
      to: "e4",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects illegal squares", () => {
    expect(
      sessionPostSchema.safeParse({
        action: "move",
        seatToken: "tok",
        from: "z9",
        to: "e4",
      }).success,
    ).toBe(false);
  });

  it("accepts resign with seat token", () => {
    expect(
      sessionPostSchema.safeParse({ action: "resign", seatToken: "tok.enough" })
        .success,
    ).toBe(true);
  });
});

describe("progressPushSchema", () => {
  it("rejects negative XP", () => {
    expect(
      progressPushSchema.safeParse({
        xp: -1,
        streak: 0,
        lastActiveDay: null,
        graduatedClasses: [],
        lessons: {},
      }).success,
    ).toBe(false);
  });

  it("rejects mastery above 1", () => {
    expect(
      progressPushSchema.safeParse({
        xp: 0,
        streak: 0,
        lastActiveDay: null,
        graduatedClasses: [],
        lessons: { foo: { mastery: 1.5, attempts: 0, lastSeen: 0, dueAt: 0 } },
      }).success,
    ).toBe(false);
  });
});
