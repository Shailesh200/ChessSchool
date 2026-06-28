"use client";

import { motion } from "framer-motion";
import { cn } from "./cn";

export function ProgressBar({
  value,
  max = 1,
  className,
  tone = "brand",
  label,
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: "brand" | "success" | "accent" | "gold";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  const toneClass = {
    brand: "bg-brand",
    success: "bg-success",
    accent: "bg-accent",
    gold: "bg-gold",
  }[tone];

  return (
    <div
      className={cn(
        "h-3 w-full overflow-hidden rounded-pill bg-surface-sunken",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.div
        className={cn("h-full rounded-pill", toneClass)}
        initial={{ width: 0 }}
        animate={{ width: `${pct * 100}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 26 }}
      />
    </div>
  );
}
