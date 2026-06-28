"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { ChessEngine } from "@/features/chess-engine/engine";
import type { BoardArrow, MoveInput, PieceSymbol, Square } from "@/core/types/chess";
import { useSettings } from "@/core/store/settings.store";
import { getBoardTheme } from "@/core/themes/themes";
import { buildPieces } from "./pieceThemes";

const PROMO_GLYPHS: Record<"w" | "b", Record<"q" | "r" | "b" | "n", string>> = {
  w: { q: "♕", r: "♖", b: "♗", n: "♘" },
  b: { q: "♛", r: "♜", b: "♝", n: "♞" },
};

// react-chessboard touches the DOM; load client-only to avoid hydration drift.
const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false, loading: () => <BoardSkeleton /> },
);

function BoardSkeleton() {
  return <div className="skeleton aspect-square w-full rounded-card" />;
}

export interface ChessBoardProps {
  fen: string;
  orientation?: "white" | "black";
  onMove?: (move: MoveInput) => boolean;
  lastMove?: { from: Square; to: Square } | null;
  arrows?: BoardArrow[];
  highlight?: Square[];
  checkSquare?: Square | null;
  interactive?: boolean;
  /** show file/rank coordinates — only on in review mode by default */
  showNotation?: boolean;
  /** fill the parent container (allow non-square) instead of forcing a square */
  fill?: boolean;
}

export function ChessBoard({
  fen,
  orientation = "white",
  onMove,
  lastMove,
  arrows = [],
  highlight = [],
  checkSquare,
  interactive = true,
  showNotation = false,
  fill = false,
}: ChessBoardProps) {
  const boardTheme = useSettings((s) => s.boardTheme);
  const pieceTheme = useSettings((s) => s.pieceTheme);
  const colors = getBoardTheme(boardTheme);
  // "classic" → react-chessboard's polished default set; themes → custom pieces.
  const pieces = useMemo(
    () => (pieceTheme === "classic" ? undefined : buildPieces(pieceTheme)),
    [pieceTheme],
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square; color: "w" | "b" } | null>(null);

  const targets = useMemo(() => {
    if (!selected) return [] as Square[];
    return new ChessEngine(fen).legalTargets(selected);
  }, [selected, fen]);

  function tryMove(from: Square, to: Square): boolean {
    if (!onMove) return false;
    const engine = new ChessEngine(fen);
    // If this move can promote, ask which piece instead of forcing a queen.
    const isPromotion = engine.legalMoves(from).some((m) => m.to === to && m.promotion);
    if (isPromotion) {
      setPromo({ from, to, color: engine.turn() });
      setSelected(null);
      return false; // wait for the user's choice
    }
    const ok = onMove({ from, to, promotion: "q" });
    if (ok) setSelected(null);
    return ok;
  }

  function choosePromotion(piece: PieceSymbol) {
    if (!promo || !onMove) return;
    onMove({ from: promo.from, to: promo.to, promotion: piece });
    setPromo(null);
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: "rgba(255, 224, 138, 0.55)" };
      styles[lastMove.to] = { background: "rgba(255, 224, 138, 0.55)" };
    }
    for (const sq of highlight) {
      styles[sq] = { boxShadow: "inset 0 0 0 4px rgba(91,91,214,0.7)", borderRadius: "8px" };
    }
    if (selected) {
      styles[selected] = { background: "rgba(123, 224, 179, 0.45)" };
    }
    for (const t of targets) {
      styles[t] = {
        ...(styles[t] ?? {}),
        background:
          "radial-gradient(circle, rgba(91,91,214,0.45) 22%, transparent 24%)",
      };
    }
    if (checkSquare) {
      styles[checkSquare] = {
        ...(styles[checkSquare] ?? {}),
        boxShadow: "inset 0 0 0 4px rgba(244,63,94,0.85)",
        borderRadius: "8px",
      };
    }
    return styles;
  }, [lastMove, highlight, selected, targets, checkSquare]);

  return (
    <div
      className={`relative overflow-hidden rounded-lg [box-shadow:var(--shadow-card)] ${
        fill ? "h-full w-full" : "aspect-square w-full"
      }`}
    >
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          animationDurationInMs: 220,
          showNotation,
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
          pieces,
          squareStyles,
          arrows,
          onSquareClick: ({ square, piece }) => {
            if (!interactive) return;
            if (selected && square !== selected) {
              const moved = tryMove(selected, square);
              if (!moved && piece) setSelected(square);
              else if (!moved) setSelected(null);
            } else if (piece) {
              setSelected(square === selected ? null : square);
            } else {
              setSelected(null);
            }
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!interactive || !targetSquare) return false;
            return tryMove(sourceSquare, targetSquare);
          },
        }}
      />

      {promo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/45 backdrop-blur-sm">
          <div className="rounded-card border border-hairline bg-surface-card p-3 [box-shadow:var(--shadow-pop)]">
            <p className="mb-2 text-center text-xs font-extrabold text-ink-700">Promote to</p>
            <div className="flex gap-2">
              {(["q", "r", "b", "n"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => choosePromotion(p)}
                  aria-label={`Promote to ${p}`}
                  className="btn-tactile flex h-14 w-14 items-center justify-center rounded-card border-2 border-hairline bg-surface text-3xl hover:border-brand"
                >
                  {PROMO_GLYPHS[promo.color][p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
