import { describe, expect, it } from "vitest";
import type { ProgressPushBody } from "@/lib/api-schemas";
import { clampIncomingXp, NO_ACTIVITY_XP_CAP } from "@/lib/progress-push-guard";
import type { ServerProgressState } from "@/lib/progress-merge";

const server: ServerProgressState = {
  xp: 100,
  streak: 1,
  lastActiveDay: null,
  dailyGoalXp: 50,
  graduatedClasses: [],
  lessons: {},
  extra: {},
};

describe("progress push guard", () => {
  it("clamps a forged XP spike to a sane per-push maximum", () => {
    const body: ProgressPushBody = {
      xp: 10_000_000,
      streak: 1,
      lastActiveDay: null,
      graduatedClasses: [],
      lessons: {},
    };
    expect(clampIncomingXp(body.xp, server.xp, body, server)).toBe(
      server.xp + NO_ACTIVITY_XP_CAP,
    );
  });

  it("allows modest XP gains tied to lesson activity", () => {
    const body: ProgressPushBody = {
      xp: 130,
      streak: 1,
      lastActiveDay: null,
      graduatedClasses: [],
      lessons: {
        "pawn-power": { mastery: 0.5, attempts: 1, lastSeen: 1, dueAt: 0 },
      },
    };
    expect(clampIncomingXp(body.xp, server.xp, body, server)).toBe(130);
  });

  it("rejects large XP gains with no supporting activity", () => {
    const body: ProgressPushBody = {
      xp: 500,
      streak: 1,
      lastActiveDay: null,
      graduatedClasses: [],
      lessons: {},
    };
    expect(clampIncomingXp(body.xp, server.xp, body, server)).toBe(
      server.xp + NO_ACTIVITY_XP_CAP,
    );
  });
});
