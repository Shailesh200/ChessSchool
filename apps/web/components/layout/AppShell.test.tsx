import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePwa } from "@/core/pwa/usePwa";
import { AppShell } from "./AppShell";

vi.mock("./TopBar", () => ({ TopBar: () => <header data-testid="topbar" /> }));
vi.mock("./SidebarNav", () => ({ SidebarNav: () => <aside data-testid="sidebar" /> }));
vi.mock("./BottomNav", () => ({ BottomNav: () => <nav data-testid="bottomnav" /> }));

describe("AppShell install banner placement", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    usePwa.setState({ canInstall: true, dismissed: false, installed: false });
  });
  afterEach(cleanup);

  it("renders the banner outside <main>, in the relative wrapper above the bottom nav", () => {
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    const main = document.getElementById("main-content") as HTMLElement;
    const card = screen.getByText("Install ChessSchool");
    expect(main.contains(card)).toBe(false);

    const bottomNav = screen.getByTestId("bottomnav");
    const wrapper = bottomNav.parentElement as HTMLElement;
    expect(wrapper).toHaveClass("relative");
    expect(wrapper.contains(card)).toBe(true);
  });
});
