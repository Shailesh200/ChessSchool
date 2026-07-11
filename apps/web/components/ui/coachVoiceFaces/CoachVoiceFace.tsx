"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../cn";
import type { CoachVoiceId } from "@/core/store/settings.store";
import { CoachVoiceFaceArt } from "./CoachVoiceFaceArt";
import { normalizeCoachVoice } from "@/lib/tts/voices";
import { VOICE_PORTRAITS } from "./portraits";

const SIZE = { sm: 52, md: 64, lg: 76 } as const;
export type CoachVoiceFaceSize = keyof typeof SIZE;

/** Flat illustrated human face for a coach TTS voice. */
export function CoachVoiceFace({
  id,
  size = "md",
  selected,
  playing,
  className,
}: {
  id: CoachVoiceId;
  size?: CoachVoiceFaceSize | number;
  selected?: boolean;
  /** Gentle pulse while voice preview plays. */
  playing?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const resolved = normalizeCoachVoice(id);
  const spec = VOICE_PORTRAITS[resolved] ?? VOICE_PORTRAITS.auto;
  const px = typeof size === "number" ? size : SIZE[size];
  const pad = Math.round(px * 0.08);

  const tile = (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2",
        "before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit] before:bg-gradient-to-b before:from-white/40 before:to-transparent",
        selected && "ring-2 ring-offset-2 ring-offset-[var(--surface-card)]",
        className,
      )}
      style={{
        width: px,
        height: px,
        borderColor: spec.tone.ring,
        background: `linear-gradient(145deg, ${spec.tone.from}, ${spec.tone.to})`,
        ...(selected ? { boxShadow: `0 0 0 2px ${spec.tone.ring}` } : {}),
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 96 96"
        width={px - pad}
        height={px - pad}
        className="relative z-[1]"
      >
        <CoachVoiceFaceArt spec={spec} />
      </svg>
      {playing && !reduced && (
        <span className="bg-brand/20 pointer-events-none absolute inset-0 animate-pulse rounded-[inherit]" />
      )}
    </span>
  );

  if (reduced) return tile;

  return (
    <motion.span
      className="inline-flex"
      animate={
        playing
          ? { scale: [1, 1.06, 1] }
          : selected
            ? { y: [0, -2, 0] }
            : { y: 0 }
      }
      transition={
        playing
          ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
          : selected
            ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
            : undefined
      }
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
    >
      {tile}
    </motion.span>
  );
}
