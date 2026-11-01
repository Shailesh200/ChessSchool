import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { flatStyle, renderRn, rnMock } from "./testing/rnHostMock";

vi.mock("react-native", async () => {
  const m = await import("./testing/rnHostMock");
  return { ...m.rnMock };
});
vi.mock("react-native-svg", async () => {
  const React = await import("react");
  const el = (n: string) => (p: { children?: React.ReactNode }) =>
    React.createElement(n, null, p.children);
  return {
    default: el("svg"),
    Path: el("path"),
    Rect: el("rect"),
    Circle: el("circle"),
    Ellipse: el("ellipse"),
  };
});
vi.mock("expo-router", () => ({
  usePathname: () => "/academy",
  useRouter: () => ({ push: () => undefined }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("./ThemeProvider", () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => "#000" }),
  }),
}));
vi.mock("./typography", () => ({
  useType: () => new Proxy({}, { get: () => ({ fontSize: 14, lineHeight: 20 }) }),
}));
vi.mock("./Icon", () => ({ Icon: () => null }));
vi.mock("./AnimatedNumber", () => ({ AnimatedNumber: () => null }));
const authState = vi.hoisted(() => ({ guest: false }));
vi.mock("./auth", () => ({
  useAuth: () => ({ guest: authState.guest, exitGuest: () => undefined }),
}));
vi.mock("./progressStore", () => ({
  useProgress: () => ({ xp: 120, streak: 3, rating: 800, graduatedClasses: [] }),
}));
// rc/nov2 routes TopBar/BottomNav to the premium kit by default. These cases
// assert the classic chrome the reflow props were written against.
vi.mock("./components/kit/useUiKit", () => ({
  useUiKit: () => "classic",
}));
vi.mock("./components/kit", () => ({
  KitBottomNav: () => null,
  KitTopBar: () => null,
}));

void rnMock;

describe("200% text layout props (UI-M-001 / UI-M-012 / UI-M-013 / UI-W-019 mirror)", () => {
  it("Logo wordmark shrinks to fit one line instead of running off the edge", async () => {
    const { Logo } = await import("./Logo");
    const nodes = renderRn(createElement(Logo, { size: 40 }));
    const word = nodes.find((n) => n.name === "Text" && n.props.adjustsFontSizeToFit);
    expect(word, "wordmark Text must set adjustsFontSizeToFit").toBeTruthy();
    expect(word!.props.numberOfLines).toBe(1);
    expect(word!.props.minimumFontScale).toBeLessThanOrEqual(0.6);
    expect(flatStyle(word!.props.style).flexShrink).toBe(1);
    const row = nodes.find((n) => n.name === "View")!;
    expect(flatStyle(row.props.style).flexShrink).toBe(1);
    expect(flatStyle(row.props.style).minWidth).toBe(0);
  });

  it("BottomNav labels are capped at 1.5 and stay on one line", async () => {
    const { BottomNav } = await import("./BottomNav");
    const labels = renderRn(createElement(BottomNav)).filter((n) => n.name === "Text");
    expect(labels).toHaveLength(4);
    for (const l of labels) {
      expect(l.props.maxFontSizeMultiplier).toBe(1.5);
      expect(l.props.numberOfLines).toBe(1);
    }
    const tab = renderRn(createElement(BottomNav)).find((n) => n.name === "Pressable")!;
    expect(flatStyle(tab.props.style).minWidth).toBe(0);
  });

  it("TopBar wraps instead of squeezing the XP track (signed-in)", async () => {
    const { TopBar } = await import("./TopBar");
    const nodes = renderRn(createElement(TopBar));
    const bar = nodes.find((n) => n.name === "View")!;
    expect(flatStyle(bar.props.style).flexWrap).toBe("wrap");
    const mid = nodes
      .filter((n) => n.name === "View")
      .map((n) => flatStyle(n.props.style))
      .find((s) => s.flexBasis === 140);
    expect(mid, "mid group needs a flexBasis so the track wraps").toBeTruthy();
    expect(mid!.flex).toBeUndefined();
    const track = nodes
      .map((n) => flatStyle(n.props.style))
      .find((s) => s.height === 10 && s.overflow === "hidden");
    expect(track!.minWidth).toBeGreaterThanOrEqual(24);
  });

  it("TopBar guest row: the brand shrinks, the Enroll pill never does", async () => {
    authState.guest = true;
    try {
      const { TopBar } = await import("./TopBar");
      const nodes = renderRn(createElement(TopBar));
      // Document order: nodes[0] is the bar, nodes[1] its brand row (before the Logo).
      const brand = flatStyle(nodes[1].props.style);
      expect(brand.flexShrink).toBe(1);
      expect(brand.minWidth).toBe(0);
      const enroll = nodes.find((n) => n.name === "Pressable")!;
      expect(flatStyle(enroll.props.style).flexShrink).toBe(0);
    } finally {
      authState.guest = false;
    }
  });
});
