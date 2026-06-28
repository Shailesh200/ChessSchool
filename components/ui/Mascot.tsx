"use client";

import { motion } from "framer-motion";
import { cn } from "./cn";

export type Expression = "happy" | "think" | "cheer" | "sad" | "wave";

/**
 * Coach crest — ChessSchool's academic emblem (a graduation cap over an open
 * book on a shield). Deliberately NOT a character mascot. Kept under the name
 * `Mascot` with the original prop shape so existing coach call-sites are
 * unchanged; `expression` now tints the crest / adds celebratory accents.
 */
export function Mascot({
  expression = "happy",
  size = 96,
  className,
  float = true,
}: {
  expression?: Expression;
  size?: number;
  className?: string;
  float?: boolean;
}) {
  const accent =
    expression === "cheer"
      ? "#f6c343"
      : expression === "sad"
        ? "#fb7185"
        : expression === "think"
          ? "#ff9a76"
          : "#5b5bd6";

  return (
    <motion.div
      className={cn("inline-block", float && "animate-bob", className)}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <defs>
          <linearGradient id="crestBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7b6ff0" />
            <stop offset="100%" stopColor="#4b46c4" />
          </linearGradient>
        </defs>
        {/* shield */}
        <path
          d="M100 24 L168 44 V104 C168 150 138 172 100 184 C62 172 32 150 32 104 V44 Z"
          fill="url(#crestBody)"
          stroke={accent}
          strokeWidth="5"
        />
        <path
          d="M100 38 L154 54 V104 C154 142 130 160 100 170 C70 160 46 142 46 104 V54 Z"
          fill="#ece9ff"
        />
        {/* open book */}
        <path d="M64 118 Q100 104 100 118 Q100 104 136 118 V140 Q100 126 100 140 Q100 126 64 140 Z" fill="#4b46c4" />
        <path d="M100 118 V140" stroke="#ece9ff" strokeWidth="2" />
        {/* graduation cap */}
        <path d="M100 62 L142 78 L100 94 L58 78 Z" fill="#2a2546" />
        <path d="M118 86 v14 c0 8 -36 8 -36 0 v-14" fill="#3a3850" />
        <circle cx="142" cy="78" r="4" fill={accent} />
        <path d="M142 78 v18" stroke={accent} strokeWidth="2.5" />
        <circle cx="142" cy="98" r="4" fill={accent} />
        {expression === "cheer" && (
          <g fill="#f6c343">
            <path d="M150 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" />
            <path d="M44 52 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 z" />
          </g>
        )}
      </svg>
    </motion.div>
  );
}
