import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPremiumTheme, premiumTokensJson } from "../../theme/premium";
import { kitButtonColors } from "../../components/kit/kitButtonColors";
import {
  PREMIUM_TAB_LABELS,
  buildCourseMap,
  campusHasPath,
  courseMapPhase,
  mapCoachLine,
  offlineLearnRows,
  premiumPreviewDecision,
  premiumTabActive,
  reviewDueCount,
  reviewTabBadge,
  type MapStage,
} from "./premiumModel";

const tactics: MapStage = {
  id: "tactics",
  name: "Tactics",
  locked: false,
  cleared: false,
  doneClasses: 1,
  totalClasses: 4,
  semesters: [
    {
      id: "forks",
      title: "Forks, pins & skewers",
      classes: [
        { id: "pins", title: "Pins", graduated: true, unlocked: true },
        { id: "forks", title: "Knight forks", graduated: false, unlocked: true },
        { id: "skewers", title: "Skewers", graduated: false, unlocked: false },
      ],
    },
  ],
};

describe("course map phase", () => {
  it("prefers offline over a failed empty load", () => {
    expect(courseMapPhase({ online: false, loading: false, failed: true, hasPath: false })).toBe("offline");
    expect(courseMapPhase({ online: false, loading: false, failed: false, hasPath: true })).toBe("offline");
  });

  it("shows loading, error, empty, then the path", () => {
    expect(courseMapPhase({ online: true, loading: true, failed: false, hasPath: false })).toBe("loading");
    expect(courseMapPhase({ online: true, loading: false, failed: true, hasPath: false })).toBe("error");
    expect(courseMapPhase({ online: true, loading: false, failed: false, hasPath: false })).toBe("empty");
    expect(courseMapPhase({ online: true, loading: false, failed: false, hasPath: true })).toBe("ready");
    expect(courseMapPhase({ online: true, loading: true, failed: false, hasPath: true })).toBe("ready");
  });
});

describe("buildCourseMap", () => {
  it("zigzags the active semester and locks the stage test until classes are done", () => {
    expect(campusHasPath([tactics])).toBe(true);
    const map = buildCourseMap([tactics]);
    expect(map).not.toBeNull();
    expect(map?.overline).toBe("Stage 1 · Tactics");
    expect(map?.title).toBe("Forks, pins & skewers");
    expect(map?.done).toBe(1);
    expect(map?.total).toBe(4);
    expect(map?.ringPercent).toBe(25);
    expect(map?.nodes.map((node) => [node.title, node.kind, node.side, node.navigable])).toEqual([
      ["Pins", "done", "l", true],
      ["Knight forks", "current", "r", true],
      ["Skewers", "locked", "l", false],
      ["Stage test", "exam", "r", false],
    ]);
    expect(map?.nodes[1]?.caption).toBe("Class 2 · up next");
    expect(map?.nodes[3]?.caption).toBe("Locked");
    expect(map?.nodes[3]?.href).toBeNull();
    expect(map?.coachLine).toBe("Knight forks next. You've got this!");
  });

  it("opens the stage test once every class in the semester is graduated", () => {
    const cleared: MapStage = {
      ...tactics,
      doneClasses: 4,
      semesters: [
        {
          id: "forks",
          title: "Forks, pins & skewers",
          classes: tactics.semesters[0]!.classes.map((cls) => ({ ...cls, graduated: true, unlocked: true })),
        },
      ],
    };
    const map = buildCourseMap([cleared]);
    const exam = map?.nodes.find((node) => node.kind === "exam");
    expect(exam?.navigable).toBe(true);
    expect(exam?.caption).toBe("Ready");
    expect(exam?.href).toEqual({ pathname: "/exam/school/[stage]", params: { stage: "tactics" } });
    expect(mapCoachLine(null)).toBe("Your path is ready when you are.");
  });

  it("uses the semester that still has an open class", () => {
    const stage: MapStage = {
      ...tactics,
      semesters: [
        {
          id: "done",
          title: "Finished unit",
          classes: [{ id: "old", title: "Old", graduated: true, unlocked: true }],
        },
        tactics.semesters[0]!,
      ],
    };
    expect(buildCourseMap([stage])?.title).toBe("Forks, pins & skewers");
  });
});

describe("offline learn rows", () => {
  it("keeps saved lessons tappable and locks the rest", () => {
    const rows = offlineLearnRows({
      resumeTitle: "Fork the king and queen",
      resumeLessonId: "fork-kq",
      dueCount: 6,
      lockedTitles: ["Spot the fork", "Class exam"],
    });
    expect(rows.ready.map((row) => row.caption)).toEqual(["Ready offline", "6 cards ready offline"]);
    expect(rows.ready[0]?.href).toBe("/lesson/fork-kq");
    expect(rows.needsInternet.every((row) => row.href === null && row.caption === "Needs internet")).toBe(true);
  });
});

describe("review tab badge and gym placement", () => {
  const now = 1_000;
  it("counts only lessons that are actually due", () => {
    expect(
      reviewDueCount(
        {
          due: { mastery: 0.4, dueAt: now, attempts: 1, lastSeen: 0 },
          later: { mastery: 0.4, dueAt: now + 1, attempts: 1, lastSeen: 0 },
          solid: { mastery: 0.95, dueAt: now, attempts: 2, lastSeen: 0 },
        },
        now,
      ),
    ).toBe(1);
    expect(reviewDueCount(null)).toBe(0);
  });

  it("hides a zero badge and announces the due count", () => {
    expect(reviewTabBadge(0).visible).toBe(false);
    expect(reviewTabBadge(6)).toEqual({ visible: true, label: "6", accessibilityLabel: "Review, 6 due" });
    expect(reviewTabBadge(120).label).toBe("99+");
  });

  it("keeps Gym on Learn and never adds a Gym tab", () => {
    expect(premiumTabActive("/gym", "academy")).toBe(true);
    expect(premiumTabActive("/dev/premium-preview", "academy")).toBe(true);
    expect(premiumTabActive("/dev/premium-preview", "play")).toBe(false);
    expect(premiumTabActive("/gym", "play")).toBe(false);
    expect(premiumTabActive("/gym", "review")).toBe(false);
    expect(premiumTabActive("/review/queue", "review")).toBe(true);
    expect(PREMIUM_TAB_LABELS).toEqual(["Learn", "Play", "Review", "Profile"]);
    const tabBar = readFileSync(path.resolve(__dirname, "../../components/kit/TabBar.tsx"), "utf8");
    expect(tabBar).not.toMatch(/label:\s*"Gym"/);
    expect(tabBar).toContain("reviewTabBadge");
    expect(tabBar).toContain("premiumTabActive");
  });
});

describe("kit button colors", () => {
  it("uses brand-soft for the soft variant and accent ink for accent", () => {
    const light = buildPremiumTheme("light");
    const soft = kitButtonColors("soft", light.colors, false);
    expect(soft.bg).toBe(premiumTokensJson.semantic.light["brand-soft"]);
    expect(soft.fg).toBe(premiumTokensJson.semantic.light["brand-soft-text"]);
    const accent = kitButtonColors("accent", light.colors, false);
    expect(accent.fg).toBe(premiumTokensJson.semantic.light["text-on-accent"]);
    expect(light.colors.nodeCurrent).toBe(premiumTokensJson.semantic.light["node-current"]);
    expect(light.colors.feature).toBe(premiumTokensJson.semantic.light.feature);
  });
});

describe("premium preview route", () => {
  it("is unreachable in the production variant and fails if that gate is removed", () => {
    expect(
      premiumPreviewDecision({ APP_VARIANT: "production", EXPO_PUBLIC_PREMIUM_PREVIEW: "1" }),
    ).toBe("deny");
    expect(premiumPreviewDecision({ APP_VARIANT: "production" })).toBe("deny");
    expect(
      premiumPreviewDecision({ APP_VARIANT: "development", EXPO_PUBLIC_PREMIUM_PREVIEW: "1" }),
    ).toBe("allow");
    expect(premiumPreviewDecision({ EXPO_PUBLIC_PREMIUM_PREVIEW: "1" })).toBe("allow");
    expect(premiumPreviewDecision({})).toBe("deny");

    const route = readFileSync(path.resolve(__dirname, "../../../app/dev/premium-preview.tsx"), "utf8");
    const layout = readFileSync(path.resolve(__dirname, "../../../app/_layout.tsx"), "utf8");
    expect(route).toContain("premiumPreviewDecision");
    expect(route).toContain("<Redirect");
    expect(route).toContain("previewDenied");
    expect(layout).toContain("premiumPreviewDecision");
    expect(layout).toContain("onPremiumPreview");
    expect(layout).toContain('APP_VARIANT: process.env.APP_VARIANT');
  });
});
