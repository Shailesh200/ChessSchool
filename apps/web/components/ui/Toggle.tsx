"use client";

import { motion } from "framer-motion";
import { haptics } from "@/core/haptics/haptics";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptics.fire("select");
        onChange(!checked);
      }}
      className={`flex h-7 w-12 items-center rounded-pill p-0.5 transition-colors ${
        checked ? "bg-success" : "bg-ink-300"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
        className="h-6 w-6 rounded-full bg-white [box-shadow:0_1px_3px_rgba(0,0,0,0.3)]"
        style={{ marginLeft: checked ? "auto" : 0 }}
      />
    </button>
  );
}
