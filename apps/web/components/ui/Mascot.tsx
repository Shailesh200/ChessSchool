"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "./cn";

export type Expression = "happy" | "think" | "cheer" | "sad" | "wave";

/**
 * Cody — ChessSchool's mascot. A premium 3D-rendered pawn "professor" with a
 * graduation cap, one artwork per expression. The container keeps the lively
 * motion (gentle float, a bounce on "cheer"); the artwork carries the pose.
 */
const SRC: Record<Expression, string> = {
  happy: "/mascots/cody-happy-v2.png",
  think: "/mascots/cody-think-v2.png",
  cheer: "/mascots/cody-cheer-v2.png",
  sad: "/mascots/cody-sad-v2.png",
  wave: "/mascots/cody-wave-v2.png",
};

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
  const cheering = expression === "cheer";

  return (
    <motion.div
      className={cn("inline-block", float && !cheering && "animate-bob", className)}
      initial={{ scale: 0.92, opacity: 0 }}
      animate={cheering ? { scale: [1, 1.1, 1], y: [0, -6, 0], opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
      transition={cheering ? { duration: 0.55, ease: "easeOut" } : { type: "spring", stiffness: 300, damping: 20 }}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Image
        src={SRC[expression] ?? SRC.happy}
        alt=""
        width={size}
        height={size}
        draggable={false}
        priority={size >= 120}
        className="h-full w-full select-none object-contain"
      />
    </motion.div>
  );
}
