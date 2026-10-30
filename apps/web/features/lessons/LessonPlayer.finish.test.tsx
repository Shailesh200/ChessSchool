import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProgression } from "@/core/store/progression.store";
import type { Lesson } from "./types";
import { LessonPlayer } from "./LessonPlayer";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/lesson/tutorial-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/board/ChessBoard", () => ({
  ChessBoard: () => <div data-testid="board" />,
}));
vi.mock("@/components/ui/coachCharacters/CoachAvatar", () => ({
  CoachAvatar: () => <div />,
}));
vi.mock("@/components/ceremony/CeremonyOverlay", () => ({
  CeremonyOverlay: () => null,
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

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** A tutorial: info steps only, so there is nothing scored and finish() navigates away. */
const TUTORIAL: Lesson = {
  id: "w006-tutorial",
  unit: "w006",
  title: "Meet the board",
  subtitle: "",
  emoji: "♟",
  prerequisites: [],
  xp: 25,
  tag: "intro",
  steps: [{ id: "s1", kind: "info", coach: "This is the board.", fen: START }],
};

describe("LessonPlayer finish (DP-W-006)", () => {
  beforeEach(() => {
    push.mockClear();
    useProgression.setState({ xp: 0 });
  });

  it("awards a tutorial's XP once when Continue is tapped repeatedly", () => {
    render(<LessonPlayer lesson={TUTORIAL} nextLessonId="w006-next" />);
    const button = screen.getByRole("button", { name: "Continue" });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(useProgression.getState().xp).toBe(TUTORIAL.xp);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/lesson/w006-next");
  });
});
