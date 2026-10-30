import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reviewDueCount } from "./catalog";
import { ReviewQueue, ReviewTab } from "./ReviewScreens";
import { FixMistakes } from "./FixMistakes";
import { GymScreen } from "./GymScreen";
import { PlayHub } from "./PlayHub";
import { PlayMatch } from "./PlayMatch";
import { StateSheet } from "./StateSheet";
import { AdminImportScreen } from "./AdminImportScreen";

vi.mock("@/core/db/db", () => ({
  listGames: vi.fn(async () => []),
  saveGame: vi.fn(async () => {}),
}));

vi.mock("@/lib/admin-actions", () => ({
  importPuzzleJsonl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(cleanup);

describe("review due count", () => {
  it("counts unseen catalog skills as due", () => {
    expect(reviewDueCount({})).toBe(6);
  });

  it("skips a mastered skill", () => {
    expect(
      reviewDueCount({
        "fork-master": { mastery: 1, attempts: 2, lastSeen: 1, dueAt: 0 },
      }),
    ).toBe(5);
  });
});

describe("chopper screens", () => {
  it("renders the review tab", async () => {
    render(<ReviewTab fixture />);
    expect(screen.getByRole("heading", { name: "6 skills are due" })).toBeTruthy();
    expect(screen.getByText("Fork the king and queen")).toBeTruthy();
    expect(
      await screen.findByText(
        "Play a match and it will appear here with a full replay.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gym/ })).toBeTruthy();
  });

  it("renders the review queue", () => {
    render(<ReviewQueue fixture />);
    expect(screen.getByText("Review queue")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start review/ })).toBeTruthy();
    expect(screen.getByText("Fix my mistakes")).toBeTruthy();
  });

  it("renders fix mistakes", () => {
    render(<FixMistakes fixture />);
    expect(screen.getByRole("heading", { name: "Here is what happened" })).toBeTruthy();
    expect(screen.getByText(/Close\. You took the pawn/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Next: find the better move/ }),
    ).toBeTruthy();
  });

  it("renders the gym", () => {
    render(<GymScreen fixture />);
    expect(screen.getByRole("heading", { name: "Gym" })).toBeTruthy();
    expect(screen.getByText("Spot the fork")).toBeTruthy();
    expect(screen.getByLabelText("Search puzzles")).toBeTruthy();
    expect(screen.getByText("8 shown")).toBeTruthy();
  });

  it("renders the play hub", () => {
    render(<PlayHub />);
    expect(screen.getByRole("heading", { name: "Play" })).toBeTruthy();
    expect(screen.getByText("Play Kira")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start game" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Skye/ })).toBeTruthy();
  });

  it("renders a Kira match", () => {
    render(<PlayMatch scene="kira" />);
    expect(screen.getByText("Yesss, clean move!")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Resign/ })).toBeTruthy();
    expect(screen.getByText("Moves")).toBeTruthy();
  });

  it("renders Ash, Rex, and Skye matches", () => {
    const { unmount } = render(<PlayMatch scene="ash" />);
    expect(screen.getByText("Impress me.")).toBeTruthy();
    unmount();
    render(<PlayMatch scene="rex" />);
    expect(screen.getByText("Observe, and learn from the best.")).toBeTruthy();
    cleanup();
    render(<PlayMatch scene="skye" />);
    expect(screen.getByText("Hmm, which piece wants the spotlight?")).toBeTruthy();
  });

  it("renders the dark match, a win, and a loss", () => {
    const { unmount } = render(<PlayMatch scene="dark" />);
    expect(screen.getByText("Yesss, clean move!")).toBeTruthy();
    expect(document.querySelector("[data-theme='dark']")).toBeTruthy();
    unmount();
    render(<PlayMatch scene="won" />);
    expect(screen.getByRole("heading", { name: "You beat Rex!" })).toBeTruthy();
    cleanup();
    render(<PlayMatch scene="lost" />);
    expect(screen.getByRole("heading", { name: "Skye won this one" })).toBeTruthy();
  });

  it("renders empty, error, and offline sheets", () => {
    const { unmount } = render(<StateSheet kind="empty" fixture />);
    expect(screen.getByRole("dialog", { name: "Nothing here yet" })).toBeTruthy();
    unmount();
    render(<StateSheet kind="error" fixture />);
    expect(screen.getByRole("dialog", { name: "Something went wrong" })).toBeTruthy();
    cleanup();
    render(<StateSheet kind="offline" fixture />);
    expect(screen.getByRole("dialog", { name: "You're offline" })).toBeTruthy();
  });

  it("renders the admin import screen", () => {
    render(<AdminImportScreen />);
    expect(
      screen.getByRole("heading", { name: "Fix the rows that need it" }),
    ).toBeTruthy();
    expect(screen.getByText("Knight fork on c7")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Publish/ })).toBeTruthy();
  });
});
