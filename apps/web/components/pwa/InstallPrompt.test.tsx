import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePwa } from "@/core/pwa/usePwa";
import { InstallPrompt, INSTALL_BANNER_SCROLL_PADDING } from "./InstallPrompt";

const DISMISS_KEY = "chessschool.install.dismissed";

function mockMatchMedia(mobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("max-width") ? mobile : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

describe("InstallPrompt overlay (CLS fix)", () => {
  let main: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(true);
    main = document.createElement("main");
    main.id = "main-content";
    document.body.appendChild(main);
    usePwa.setState({ canInstall: true, dismissed: false, installed: false });
  });

  afterEach(() => {
    cleanup();
    main.remove();
  });

  it("is an absolute, pointer-events-none overlay so it never shifts <main>", () => {
    const { container } = render(<InstallPrompt />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("absolute", "pointer-events-none", "bottom-full");

    const card = screen.getByText("Install ChessSchool").closest(".rounded-card");
    expect(card).not.toBeNull();
    expect(card).toHaveClass("pointer-events-auto");
    expect(card).not.toHaveClass("pointer-events-none");
  });

  it("adds scroll-padding-bottom to main only while the banner is shown", () => {
    render(<InstallPrompt />);
    expect(main.style.scrollPaddingBottom).toBe(INSTALL_BANNER_SCROLL_PADDING);

    fireEvent.click(screen.getByLabelText("Dismiss install prompt"));
    expect(main.style.scrollPaddingBottom).toBe("");
  });

  it("dismiss persists in localStorage and hides the banner", () => {
    render(<InstallPrompt />);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();

    fireEvent.click(screen.getByLabelText("Dismiss install prompt"));
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
    expect(usePwa.getState().dismissed).toBe(true);
  });

  it("stays hidden (no padding) on desktop widths", () => {
    mockMatchMedia(false);
    render(<InstallPrompt />);
    expect(screen.queryByText("Install ChessSchool")).toBeNull();
    expect(main.style.scrollPaddingBottom).toBe("");
  });

  it("does not render a banner after a previous dismissal", () => {
    act(() => usePwa.setState({ canInstall: false, dismissed: true }));
    render(<InstallPrompt />);
    expect(screen.queryByText("Install ChessSchool")).toBeNull();
  });
});
