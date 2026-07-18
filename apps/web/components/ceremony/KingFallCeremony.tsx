"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getPieceTheme } from "@/features/board/pieceThemes";
import { useSettings } from "@/core/store/settings.store";

const FALL_MS = 1500;

/** Resolve king asset for the active piece theme (silhouette family). */
export function kingSilhouetteSrc(pieceThemeId: string, color: "w" | "b"): string {
  const theme = getPieceTheme(pieceThemeId);
  if (theme.style === "asset" && theme.shapeSet !== "staunton") {
    return `/pieces/${theme.shapeSet}/${color}K.svg`;
  }
  // Marble / sculpted — fall back to Classic Staunton silhouette.
  return `/pieces/cburnett/${color}K.svg`;
}

/**
 * Checkmate beat: loser's king falls (theme silhouette), then caller opens
 * “How it happened” after {@link FALL_MS}.
 */
export function KingFallCeremony({
  open,
  loserColor,
  onComplete,
  durationMs = FALL_MS,
}: {
  open: boolean;
  loserColor: "w" | "b";
  onComplete: () => void;
  durationMs?: number;
}) {
  const pieceTheme = useSettings((s) => s.pieceTheme);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const src = kingSilhouetteSrc(pieceTheme, loserColor);
  const tip = loserColor === "w" ? 78 : -78;

  useEffect(() => {
    if (!open) return;
    const ms = reducedMotion ? 200 : durationMs;
    const t = window.setTimeout(onComplete, ms);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onComplete, reducedMotion]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          aria-hidden
        >
          <div className="bg-ink/35 absolute inset-0 rounded-[inherit] backdrop-blur-[1px]" />
          {reducedMotion ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="relative h-[28%] w-[28%] object-contain opacity-40"
              draggable={false}
            />
          ) : (
            <motion.img
              key={`${src}-${loserColor}`}
              src={src}
              alt=""
              draggable={false}
              className="relative h-[30%] w-[30%] object-contain drop-shadow-lg"
              initial={{ y: 0, rotate: 0, opacity: 1, scale: 1.15 }}
              animate={{ y: "42%", rotate: tip, opacity: 0.2, scale: 0.92 }}
              transition={{
                duration: durationMs / 1000,
                ease: [0.55, 0.02, 0.75, 0.35],
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const KING_FALL_MS = FALL_MS;
