"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getPieceTheme } from "@/features/board/pieceThemes";
import { getBoardTheme } from "@/core/themes/themes";
import { useSettings } from "@/core/store/settings.store";
import type { Square } from "@/core/types/chess";

const CRUSH_MS = 1500;

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

/** Jagged shards — together they form the king; apart they read as crushed. */
const SHARDS: {
  clip: string;
  x: number;
  y: number;
  r: number;
  delay: number;
}[] = [
  {
    clip: "polygon(0% 0%, 56% 0%, 40% 100%, 0% 100%)",
    x: -14,
    y: 10,
    r: -16,
    delay: 0.18,
  },
  {
    clip: "polygon(56% 0%, 100% 0%, 100% 46%, 48% 38%)",
    x: 12,
    y: -10,
    r: 18,
    delay: 0.2,
  },
  {
    clip: "polygon(48% 38%, 100% 46%, 100% 100%, 40% 100%)",
    x: 10,
    y: 16,
    r: 12,
    delay: 0.22,
  },
];

/**
 * Checkmate beat: crush the mated king **on its board square** (broken shards),
 * then caller opens “How it happened” after {@link CRUSH_MS}.
 */
export function KingFallCeremony({
  open,
  square,
  orientation,
  loserColor,
  onComplete,
  durationMs = CRUSH_MS,
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
  const board = getBoardTheme(boardThemeId);
  const secs = durationMs / 1000;

  useEffect(() => {
    if (!open || !square) return;
    const ms = reducedMotion ? 200 : durationMs;
    const t = window.setTimeout(onComplete, ms);
    return () => window.clearTimeout(t);
  }, [open, square, durationMs, onComplete, reducedMotion]);

  if (!square) return null;

  const cell = squareCellStyle(square, orientation);
  const cover = isLightSquare(square) ? board.light : board.dark;
  const crack = loserColor === "w" ? "rgba(30,28,40,0.75)" : "rgba(250,248,255,0.7)";

  return (
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
          <div
            className="absolute overflow-visible"
            style={{ ...cell, backgroundColor: cover }}
          >
            <div className="relative mx-auto h-[88%] w-[88%]" style={{ marginTop: "6%" }}>
              {reducedMotion ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-contain opacity-35"
                  style={{ filter: "grayscale(0.4) contrast(1.1)" }}
                  draggable={false}
                />
              ) : (
                <>
                  {/* Impact squash of the whole piece, then shards take over. */}
                  <motion.img
                    key={`crush-whole-${src}-${square}`}
                    src={src}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-contain"
                    initial={{ scaleX: 1, scaleY: 1, opacity: 1 }}
                    animate={{
                      scaleX: [1, 1.18, 1.22],
                      scaleY: [1, 0.72, 0.55],
                      opacity: [1, 1, 0],
                    }}
                    transition={{
                      duration: secs * 0.28,
                      times: [0, 0.55, 1],
                      ease: "easeIn",
                    }}
                  />
                  {SHARDS.map((shard, i) => (
                    <motion.div
                      key={`shard-${i}`}
                      className="absolute inset-0"
                      style={{ clipPath: shard.clip }}
                      initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 1 }}
                      animate={{
                        x: shard.x,
                        y: shard.y,
                        rotate: shard.r,
                        opacity: [0, 1, 0.85, 0.4],
                        scale: [1, 1, 0.96, 0.9],
                      }}
                      transition={{
                        duration: secs,
                        delay: shard.delay * secs,
                        times: [0, 0.05, 0.55, 1],
                        ease: [0.22, 0.8, 0.35, 1],
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-contain"
                        style={{ filter: "saturate(0.85) contrast(1.05)" }}
                      />
                    </motion.div>
                  ))}
                  {/* Crack lines over the break. */}
                  <motion.svg
                    viewBox="0 0 100 100"
                    className="absolute inset-0 h-full w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0, 1, 0.7] }}
                    transition={{ duration: secs, times: [0, 0.2, 0.35, 1] }}
                  >
                    <path
                      d="M48 8 L42 38 L55 52 L38 72 L50 94"
                      fill="none"
                      stroke={crack}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M42 38 L22 48"
                      fill="none"
                      stroke={crack}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M55 52 L78 44"
                      fill="none"
                      stroke={crack}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M38 72 L18 78"
                      fill="none"
                      stroke={crack}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </motion.svg>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** @deprecated alias — ceremony is a crush now, duration unchanged. */
export const KING_FALL_MS = CRUSH_MS;
export const KING_CRUSH_MS = CRUSH_MS;
