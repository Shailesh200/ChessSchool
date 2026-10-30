import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LessonPlayer, LessonComplete } from "./LessonPlayer";
import {
  LESSON_KIT_DEV_FIXTURES,
  resolveKitLessonScreen,
  type KitLessonScreenId,
} from "./lessonKitDevFixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dev/lesson-kit",
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
vi.mock("@/components/motion/KitLottie", () => ({
  KitLottie: () => <span data-testid="kit-lottie-stub" />,
}));

const EXPECTED_SCREEN: Record<
  keyof typeof LESSON_KIT_DEV_FIXTURES,
  KitLessonScreenId
> = {
  "05a": "les-intro",
  "05b": "les-drill",
  "05c": "les-tap",
  "05d": "les-quiz",
  "06a": "les-correct",
  "06b": "les-wrong",
  "07": "les-hint",
  "08": "les-complete",
};

describe("kit lesson screen markers (390 / 1280 layout QA)", () => {
  for (const [key, expected] of Object.entries(EXPECTED_SCREEN) as Array<
    [keyof typeof LESSON_KIT_DEV_FIXTURES, KitLessonScreenId]
  >) {
    it(`maps dev fixture ${key} to kit data-screen=${expected}`, () => {
      const fixture = LESSON_KIT_DEV_FIXTURES[key];
      if (fixture.complete) {
        render(
          <LessonComplete
            lesson={fixture.lesson}
            correct={2}
            mistakes={0}
            ceremony={null}
            durationMs={60_000}
            hintsUsed={0}
            interactiveSteps={2}
            onDone={vi.fn()}
          />,
        );
        expect(screen.getByTestId("lesson-complete-screen")).toHaveAttribute(
          "data-screen",
          expected,
        );
        return;
      }
      render(<LessonPlayer lesson={fixture.lesson} devPreview={fixture.preview} />);
      expect(screen.getByTestId("lesson-stage")).toHaveAttribute("data-screen", expected);
      expect(screen.getByTestId("lesson-stage").querySelector(".lgrid")).toBeTruthy();
      expect(screen.getByTestId("lesson-coach-panel")).toBeInTheDocument();
      expect(screen.getByTestId("lesson-board-slot")).toBeInTheDocument();
    });
  }

  it("resolveKitLessonScreen matches kit les-tap when visual squares are set", () => {
    const step = LESSON_KIT_DEV_FIXTURES["05c"].lesson.steps[0]!;
    expect(
      resolveKitLessonScreen({ phase: "playing", step, hintLevel: 0 }),
    ).toBe("les-tap");
  });
});
