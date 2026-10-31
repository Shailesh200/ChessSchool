import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProgression } from "@/core/store/progression.store";
import { PlayHub } from "./PlayHub";
import { PlayMatch } from "./PlayMatch";
import { PlayScreen } from "./PlayScreen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/core/db/db", () => ({
  saveGame: vi.fn(async () => {}),
}));

afterEach(() => {
  cleanup();
  useProgression.setState({ xp: 0, streak: 0, lessons: {} });
});

describe("illustrated play shell", () => {
  it("renders the hub with the design quick-game card and Ash switch", () => {
    render(<PlayHub />);
    expect(document.querySelector(".hero.feat")).toBeTruthy();
    expect(document.querySelector(".gframe.tile.heroart")).toBeTruthy();
    const ash = screen.getByRole("switch", { name: "Add Ash to opponents" });
    expect(ash.className).toContain("tg");
    expect(ash.textContent).toBe("");
    expect(screen.getByRole("link", { name: /Daily puzzle/ })).toBeTruthy();
  });

  it("shows the seeded streak, XP, and review badge in the dex chrome", () => {
    useProgression.setState({ xp: 1240, streak: 12, lessons: {} });
    render(<PlayScreen />);
    const chips = screen.getByRole("group", { name: "Your streak and XP" });
    expect(chips).toHaveTextContent("12");
    expect(chips).toHaveTextContent("1,240");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getAllByText("6").length).toBeGreaterThan(0);
  });

  it("renders the fixture match board, move 5, and the current ply", () => {
    render(<PlayMatch scene="kira" />);
    expect(
      screen.getByRole("img", {
        name: "Game position. White to move. Black just played knight to f6.",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Move 5")).toBeTruthy();
    expect(document.querySelector(".moves .cur")?.textContent).toBe("Nf6");
  });

  it("uses the design result copy for a win and a loss", () => {
    const { unmount } = render(<PlayMatch scene="won" />);
    expect(screen.getByRole("heading", { name: "You beat Rex!" })).toBeTruthy();
    expect(screen.getByText("50 XP")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resign this game" })).toBeTruthy();
    unmount();
    render(<PlayMatch scene="lost" />);
    expect(screen.getByRole("heading", { name: "Skye won this one" })).toBeTruthy();
    expect(screen.getByText("20 XP")).toBeTruthy();
    expect(screen.getByText(/for playing/)).toBeTruthy();
  });
});
