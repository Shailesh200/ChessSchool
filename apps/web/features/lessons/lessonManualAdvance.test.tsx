import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LessonPlayer } from "./LessonPlayer";
import type { Lesson } from "./types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/lesson/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/board/ChessBoard", () => ({
  ChessBoard: (props: { onMove?: (m: { from: string; to: string }) => boolean }) => (
    <button
      type="button"
      data-testid="mock-move"
      onClick={() => props.onMove?.({ from: "e2", to: "e4" })}
    >
      move
    </button>
  ),
}));
vi.mock("@/components/ui/coachCharacters/CoachAvatar", () => ({
  CoachAvatar: () => <div />,
}));
vi.mock("@/components/ceremony/CeremonyOverlay", () => ({
  CeremonyOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/auth/EnrollPrompt", () => ({
  EnrollPrompt: () => null,
  EnrollPromptBanner: () => null,
}));
vi.mock("@/features/journal/ReflectSheet", () => ({ ReflectSheet: () => null }));
vi.mock("@/core/audio/audioEngine", () => ({
  audio: { play: vi.fn(), unlock: vi.fn(), stop: vi.fn() },
}));
vi.mock("@/core/audio/coachSpeech", () => ({ prefetchCoachText: vi.fn() }));
vi.mock("@/core/hooks/useCoachSpeech", () => ({ useCoachSpeech: vi.fn() }));
vi.mock("@/core/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/pulse", () => ({ pulseTrack: vi.fn() }));
vi.mock("@/core/store/nav.store", () => ({ startNav: vi.fn() }));
vi.mock("@/components/motion/KitLottie", () => ({
  KitLottie: () => <span data-testid="kit-lottie-stub" />,
}));

const MOVE: Lesson = {
  id: "manual-move",
  unit: "u",
  title: "Forks",
  subtitle: "Fork the king and queen",
  emoji: "♞",
  prerequisites: [],
  xp: 20,
  tag: "fork",
  steps: [
    {
      id: "m1",
      kind: "move",
      coach: "Find the fork.",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      solution: ["e2:e4"],
      successText: "Nice fork!",
      failText: "Not quite — try again!",
    },
  ],
};

describe("LessonPlayer manual feedback bars", () => {
  it("stays on the correct bar until Continue is pressed (no timer auto-advance)", () => {
    vi.useFakeTimers();
    render(<LessonPlayer lesson={MOVE} />);
    fireEvent.click(screen.getByTestId("mock-move"));
    expect(screen.getByTestId("lesson-fbar-correct")).toBeInTheDocument();
    vi.advanceTimersByTime(5000);
    expect(screen.getByTestId("lesson-fbar-correct")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByTestId("lesson-fbar-correct")).toBeNull();
    vi.useRealTimers();
  });
});
