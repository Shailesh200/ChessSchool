"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

type Variant = "primary" | "accent" | "ghost" | "success" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const base =
  "btn-tactile relative inline-flex max-w-full select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-pill font-bold tracking-tight transition-colors focus-visible:outline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white [box-shadow:var(--shadow-button)] hover:bg-brand-600 active:bg-brand-600",
  accent:
    "bg-accent text-white [box-shadow:var(--shadow-button-accent)] hover:bg-accent-600",
  success: "bg-success text-white [box-shadow:0_4px_0_0_var(--success-600)]",
  danger: "bg-danger text-white [box-shadow:0_4px_0_0_#be123c]",
  ghost: "bg-transparent text-ink-700 hover:bg-surface-sunken",
  outline:
    "bg-surface-card text-ink border-2 border-hairline hover:border-brand-300 [box-shadow:0_2px_0_0_var(--hairline)]",
};

const sizes: Record<Size, string> = {
  sm: "h-11 px-4 text-sm", // 44px min tap target (#100)
  md: "h-12 px-6 text-base",
  lg: "h-14 px-8 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, className, onClick, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      onClick={(e) => {
        haptics.fire("tap");
        audio.play("select");
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
});
