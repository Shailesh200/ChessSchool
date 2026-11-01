import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The plan screen is a React component, and the mobile suite has no renderer.
 * React is replaced by stubs here, so PlanScreen can be called as a plain
 * function. That returns the element tree, and the pace buttons' onPress runs
 * for real, against a mocked settings store and a mocked mutateProgress.
 */
type El = { type: unknown; props: Record<string, unknown> };

const h = vi.hoisted(() => ({
  settingsSet: vi.fn(),
  mutateProgress: vi.fn(async (_edit: unknown) => undefined),
  planTier: "casual",
}));

vi.mock("react", () => ({
  useEffect: () => undefined,
  useMemo: (fn: () => unknown) => fn(),
  useState: (v: unknown) => [v, () => undefined],
}));
vi.mock("react/jsx-runtime", () => ({
  jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
  jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
  Fragment: "Fragment",
}));
vi.mock("react/jsx-dev-runtime", () => ({
  jsxDEV: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
  Fragment: "Fragment",
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (s: unknown) => s },
  Platform: { OS: "ios" },
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/api", () => ({ api: vi.fn(async () => ({ byType: {} })) }));
vi.mock("@/settings", () => ({
  settings: { set: h.settingsSet },
  useSettings: () => ({
    planTier: h.planTier,
    customGoalXp: 60,
    schedule: "daily",
  }),
}));
vi.mock("@/progressStore", () => ({
  useProgress: () => ({}),
  mutateProgress: h.mutateProgress,
}));
vi.mock("@/progression", () => ({ isoDay: () => "2026-10-29" }));
vi.mock("@/typography", () => ({ useType: () => ({}) }));
vi.mock("@/theme", () => {
  const any = new Proxy({}, { get: () => 0 });
  return { colors: any, font: any, radius: any, shadowCard: {}, space: any };
});
vi.mock("@/AppShell", () => ({ AppShell: "AppShell" }));
vi.mock("@/BackButton", () => ({ BackButton: "BackButton" }));
vi.mock("@/Button", () => ({ Button: "Button" }));
vi.mock("@/Slider", () => ({ Slider: "Slider" }));
vi.mock("@/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/iconMaps", () => ({ emojiToIcon: () => "icon" }));

function find(node: unknown, testID: string): El | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, testID);
      if (hit) return hit;
    }
    return null;
  }
  const el = node as El;
  if (el.props?.testID === testID) return el;
  return find(el.props?.children, testID);
}

async function screen() {
  const mod = await import("../app/homework");
  return (mod.default as () => unknown)();
}

beforeEach(() => {
  h.settingsSet.mockClear();
  h.mutateProgress.mockClear();
  h.planTier = "casual";
});

describe("homework screen: picking a pace writes the daily goal with its stamp", () => {
  it.each([
    ["standard", 50],
    ["serious", 80],
    ["competitive", 130],
  ])(
    "%s sets the tier and sends a goal of %i XP with a new stamp",
    async (tier, xp) => {
      const tree = await screen();
      const button = find(tree, `pace-${tier}`);
      expect(button, tier).not.toBeNull();
      (button!.props.onPress as () => void)();
      await vi.waitFor(() => expect(h.mutateProgress).toHaveBeenCalledTimes(1));
      expect(h.settingsSet).toHaveBeenCalledWith("planTier", tier);

      const edit = h.mutateProgress.mock.calls[0]![0] as unknown as (
        snap: Record<string, unknown>,
      ) => Record<string, unknown>;
      const before = Date.now();
      const next = edit({ xp: 7, dailyGoalXp: 30, goalUpdatedAt: 1_000 });
      expect(next.dailyGoalXp).toBe(xp);
      expect(next.xp).toBe(7);
      expect(next.goalUpdatedAt).toBeGreaterThanOrEqual(before);
    },
  );

  it("picking the goal that is already stored changes nothing", async () => {
    const tree = await screen();
    (find(tree, "pace-standard")!.props.onPress as () => void)();
    await vi.waitFor(() => expect(h.mutateProgress).toHaveBeenCalledTimes(1));
    const edit = h.mutateProgress.mock.calls[0]![0] as unknown as (
      snap: Record<string, unknown>,
    ) => Record<string, unknown>;
    const snap = { dailyGoalXp: 50, goalUpdatedAt: 1_000 };
    expect(edit(snap)).toBe(snap);
  });
});
