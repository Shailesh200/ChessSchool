"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getPieceTheme } from "@/features/board/pieceThemes";
import { getBoardTheme } from "@/core/themes/themes";
import { useSettings } from "@/core/store/settings.store";
import type { Square } from "@/core/types/chess";

const FALL_MS = 1500;

/** Resolve king asset for the active piece theme (silhouette family). */
export function kingSilhouetteSrc(pieceThemeId: string, color: "w" | "b"): string {
  const theme = getPieceTheme(pieceThemeId);
  if (theme.style === "asset" && theme.shapeSet !== "staunton") {
    return `/pieces/${theme.shapeSet}/${color}K.svg`;
  }
  return `/pieces/cburnett/${color}K.svg`;
}

/** Board-cell percent rect for a square given orientation. */
export function squareCellStyle(
  square: Square,
  orientation: "white" | "black",
): { left: string; top: string; width: string; height: string } {
  const file = square.charCodeAt(0) - 97; // a=0
  const rank = Number(square[1]) - 1; // 1=0
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return {
    left: `${col * 12.5}%`,
    top: `${row * 12.5}%`,
    width: "12.5%",
    height: "12.5%",
  };
}

function isLightSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return (file + rank) % 2 === 1;
}

/**
 * Checkmate beat: loser's king tips over **on its board square**, then caller
 * opens “How it happened” after {@link FALL_MS}.
 */
export function KingFallCeremony({
  open,
  square,
  orientation,
  loserColor,
  onComplete,
  durationMs = FALL_MS,
}: {
  open: boolean;
  square: Square | null;
  orientation: "white" | "black";
  loserColor: "w" | "b";
  onComplete: () => void;
  durationMs?: number;
}) {
  const pieceTheme = useSettings((s) => s.pieceTheme);
  const boardThemeId = useSettings((s) => s.boardTheme);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const src = kingSilhouetteSrc(pieceTheme, loserColor);
  const tip = loserColor === "w" ? 72 : -72;
  const board = getBoardTheme(boardThemeId);

  useEffect(() => {
    if (!open || !square) return;
    const ms = reducedMotion ? 200 : durationMs;
    const t = window.setTimeout(onComplete, ms);
    return () => window.clearTimeout(t);
  }, [open, square, durationMs, onComplete, reducedMotion]);

  if (!square) return null;

  const cell = squareCellStyle(square, orientation);
  const cover = isLightSquare(square) ? board.light : board.dark;

  return (
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
          {/* Cover the live king on that cell, then tip the silhouette in-place. */}
          <div
            className="absolute flex items-center justify-center overflow-visible"
            style={{ ...cell, backgroundColor: cover }}
          >
            {reducedMotion ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                className="h-[88%] w-[88%] object-contain opacity-40"
                draggable={false}
              />
            ) : (
              <motion.img
                key={`${src}-${square}`}
                src={src}
                alt=""
                draggable={false}
                className="h-[88%] w-[88%] object-contain"
                style={{ transformOrigin: "50% 82%" }}
                initial={{ rotate: 0, y: 0, opacity: 1 }}
                animate={{ rotate: tip, y: "8%", opacity: 0.55 }}
                transition={{
                  duration: durationMs / 1000,
                  ease: [0.45, 0.05, 0.55, 0.95],
                }}
              />
            )}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export const KING_FALL_MS = FALL_MS;
