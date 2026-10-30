import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChessBoard } from "./ChessBoard";

const MockChessboard = vi.hoisted(() =>
  vi.fn((props: { options: { squareStyles?: Record<string, unknown> } }) => (
    <div data-testid="board" data-square-styles={JSON.stringify(props.options.squareStyles ?? {})} />
  )),
);

vi.mock("next/dynamic", () => ({
  default: () => MockChessboard,
}));
vi.mock("react-chessboard", () => ({
  Chessboard: MockChessboard,
}));
vi.mock("@/features/chess-engine/engine", () => ({
  ChessEngine: class {
    legalMoves() {
      return [];
    }
  },
}));
vi.mock("@/core/store/settings.store", () => ({
  useSettings: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      colorblind: false,
      boardTheme: "classic",
      pieceTheme: "classic",
      reducedMotion: true,
    }),
}));

describe("ChessBoard kit ring highlights", () => {
  it("applies inset ring styles for ringSquares (05c tap highlight)", () => {
    render(
      <ChessBoard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        ringSquares={["e4"]}
      />,
    );
    const styles = JSON.parse(
      screen.getByTestId("board").getAttribute("data-square-styles") ?? "{}",
    );
    expect(styles.e4?.boxShadow).toContain("inset");
  });
});
