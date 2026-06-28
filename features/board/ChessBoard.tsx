"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { ChessEngine } from "@/features/chess-engine/engine";
import type { BoardArrow, MoveInput, Square } from "@/core/types/chess";
import { useSettings } from "@/core/store/settings.store";
import { getBoardTheme } from "@/core/themes/themes";

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
}: ChessBoardProps) {
  const boardTheme = useSettings((s) => s.boardTheme);
  const colors = getBoardTheme(boardTheme);
  const [selected, setSelected] = useState<Square | null>(null);

  const targets = useMemo(() => {
    if (!selected) return [] as Square[];
    return new ChessEngine(fen).legalTargets(selected);
  }, [selected, fen]);

  function tryMove(from: Square, to: Square): boolean {
    if (!onMove) return false;
    const ok = onMove({ from, to, promotion: "q" });
    if (ok) setSelected(null);
    return ok;
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
    <div className="aspect-square w-full overflow-hidden rounded-card [box-shadow:var(--shadow-card)]">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          animationDurationInMs: 220,
          showNotation: true,
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
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
    </div>
  );
}
