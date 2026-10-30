import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitLottie } from "@/components/motion/KitLottie";
import { LessonKitFooter } from "./LessonKitFooter";
import { LessonPlayer, LessonComplete } from "./LessonPlayer";
import type { Lesson } from "./types";

const useReducedMotionMock = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/core/hooks/useReducedMotion", () => ({
  useReducedMotion: () => useReducedMotionMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/lesson/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/board/ChessBoard", () => ({
  ChessBoard: () => <div data-testid="board" />,
}));
vi.mock("@/components/ui/coachCharacters/CoachAvatar", () => ({
  CoachAvatar: () => <div data-testid="coach" />,
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
vi.mock("lottie-react", () => ({
  default: () => <div data-testid="lottie-player" />,
}));

describe("KitLottie", () => {
  it("shows a PNG still when prefers-reduced-motion is set", () => {
    useReducedMotionMock.mockReturnValue(true);
    render(<KitLottie id="success-burst" />);
    expect(screen.getByTestId("kit-lottie-still-success-burst")).toBeInTheDocument();
    expect(screen.queryByTestId("lottie-player")).toBeNull();
    useReducedMotionMock.mockReturnValue(false);
  });

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("lazy-loads JSON when motion is allowed", async () => {
    useReducedMotionMock.mockReturnValue(false);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ v: "5.7.4", layers: [] }),
    } as Response);
    render(<KitLottie id="error-shake" />);
    await waitFor(() =>
      expect(screen.getByTestId("kit-lottie-error-shake")).toHaveAttribute(
        "data-kit-lottie-loaded",
        "1",
      ),
    );
    expect(fetchSpy).toHaveBeenCalledWith("/kit/lottie/error-shake.json");
    fetchSpy.mockRestore();
  });
});

describe("LessonKitFooter", () => {
  it("renders the kit success feedback bar", () => {
    render(
      <LessonKitFooter
        phase="correct"
        stepKind="move"
        observeReady
        playing={false}
        solvable
        successTitle="Nice fork!"
        successWhy="Because tactics."
        failTitle="Not quite"
        failWhy="Try again"
        onContinue={vi.fn()}
        onShowHint={vi.fn()}
      />,
    );
    const root = screen.getByTestId("lesson-fbar-correct");
    expect(root.querySelector(".cs-fbar")).toBeTruthy();
    expect(root.querySelector(".cs-fbar--wrong")).toBeNull();
  });

  it("renders the kit wrong feedback bar", () => {
    render(
      <LessonKitFooter
        phase="wrong"
        stepKind="move"
        observeReady
        playing={false}
        solvable
        successTitle="Nice"
        successWhy=""
        failTitle="Not quite"
        failWhy="Look for a fork."
        onContinue={vi.fn()}
        onShowHint={vi.fn()}
      />,
    );
    expect(screen.getByTestId("lesson-fbar-wrong").querySelector(".cs-fbar--wrong")).toBeTruthy();
  });
});

const MOVE_LESSON: Lesson = {
  id: "kit-move",
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

describe("LessonPlayer kit UI", () => {
  it("shows the hint ladder after a hint tap", () => {
    render(<LessonPlayer lesson={MOVE_LESSON} />);
    fireEvent.click(screen.getByTestId("lesson-hint-button"));
    expect(screen.getByTestId("lesson-hint-ladder")).toBeInTheDocument();
  });

  it("renders the kit lesson stage shell", () => {
    render(<LessonPlayer lesson={MOVE_LESSON} />);
    expect(screen.getByTestId("lesson-stage")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-drill-bar")).toBeInTheDocument();
  });
});

describe("LessonComplete kit UI", () => {
  it("renders the kit complete layout", () => {
    render(
      <LessonComplete
        lesson={MOVE_LESSON}
        correct={2}
        mistakes={0}
        ceremony={null}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByTestId("lesson-complete-screen")).toBeInTheDocument();
    expect(screen.getByTestId("kit-lottie-confetti")).toBeInTheDocument();
    expect(screen.getByTestId("kit-lottie-streak-flame")).toBeInTheDocument();
  });
});
