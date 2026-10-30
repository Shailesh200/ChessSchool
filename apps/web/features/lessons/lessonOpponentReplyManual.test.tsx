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

const REPLY_LESSON: Lesson = {
  id: "reply-manual",
  unit: "u",
  title: "Two-step",
  subtitle: "",
  emoji: "♞",
  prerequisites: [],
  xp: 20,
  tag: "opening",
  steps: [
    {
      id: "m1",
      kind: "move",
      coach: "Play e4.",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      solution: ["e2:e4"],
      successText: "Good opening!",
      failText: "Try e4.",
    },
    {
      id: "m2",
      kind: "move",
      coach: "Develop the knight.",
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
      solution: ["g1:f3"],
      successText: "Nice!",
      failText: "Try again.",
    },
  ],
};

describe("LessonPlayer opponent reply manual continue", () => {
  it("requires Continue after the reply animation before advancing (regression guard)", () => {
    vi.useFakeTimers();
    render(<LessonPlayer lesson={REPLY_LESSON} />);
    fireEvent.click(screen.getByTestId("mock-move"));
    expect(screen.getByTestId("lesson-fbar-correct")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    vi.advanceTimersByTime(900);
    expect(screen.getByTestId("lesson-fbar-correct")).toBeInTheDocument();

    vi.advanceTimersByTime(10_000);
    expect(screen.getByTestId("lesson-fbar-correct")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByTestId("lesson-fbar-correct")).toBeNull();
    expect(screen.getByTestId("lesson-coach-bubble")).toHaveTextContent("Develop the knight.");
    vi.useRealTimers();
  });
});
