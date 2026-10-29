import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lastMoveFrames } from "@/features/review/replay";
import { MatchMateReviewModal } from "./MatchMateReviewModal";

vi.mock("@/features/board/ChessBoard", () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="review-fen">{fen}</div>,
}));

vi.mock("@/core/audio/audioEngine", () => ({
  audio: { play: vi.fn(), unlock: vi.fn() },
}));

/** Scholar's mate — several replay frames, last one is checkmate. */
const PGN = "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#";

const INITIAL_MS = 700;
const STEP_MS = 900;

function stepLabel(step: number, total: number) {
  return `Replaying — step ${step} of ${total} · loops`;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("MatchMateReviewModal replay timers", () => {
  const total = lastMoveFrames(PGN, 5).length;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances each ply on the step delay under fake timers", async () => {
    render(
      <MatchMateReviewModal
        open
        pgn={PGN}
        orientation="white"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText(stepLabel(1, total))).toBeInTheDocument();
    const openingFen = screen.getByTestId("review-fen").textContent;

    await advance(INITIAL_MS - 1);
    expect(screen.getByText(stepLabel(1, total))).toBeInTheDocument();

    await advance(1);
    expect(screen.getByText(stepLabel(2, total))).toBeInTheDocument();
    expect(screen.getByTestId("review-fen").textContent).not.toBe(openingFen);

    // A setState from the advance re-renders the session. If `schedule` were a
    // fresh function, that render would restart the effect and the next ply
    // would be armed for INITIAL_MS instead of STEP_MS.
    await advance(INITIAL_MS);
    expect(screen.getByText(stepLabel(2, total))).toBeInTheDocument();

    await advance(STEP_MS - INITIAL_MS);
    expect(screen.getByText(stepLabel(3, total))).toBeInTheDocument();

    const remainingSteps = total - 3;
    await advance(remainingSteps * STEP_MS);
    expect(
      screen.getByText(`Checkmate — looping · step ${total} of ${total}`),
    ).toBeInTheDocument();
  });

  it("does not restart the replay when the parent re-renders", async () => {
    const params = {
      open: true,
      pgn: PGN,
      orientation: "white" as const,
      onClose: () => undefined,
    };
    const view = render(<MatchMateReviewModal {...params} />);

    await advance(INITIAL_MS);
    expect(screen.getByText(stepLabel(2, total))).toBeInTheDocument();

    view.rerender(<MatchMateReviewModal {...params} onClose={() => undefined} />);

    await advance(INITIAL_MS);
    expect(screen.getByText(stepLabel(2, total))).toBeInTheDocument();

    await advance(STEP_MS - INITIAL_MS);
    expect(screen.getByText(stepLabel(3, total))).toBeInTheDocument();
  });
});
