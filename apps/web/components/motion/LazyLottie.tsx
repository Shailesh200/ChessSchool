"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { useReducedMotion } from "@/core/hooks/useReducedMotion";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export type LottieAsset =
  | "lesson-complete"
  | "class-graduate"
  | "exam-pass"
  | "achievement-unlock"
  | "streak-milestone";

const SRC: Record<LottieAsset, string> = {
  "lesson-complete": "/lottie/lesson-complete.json",
  "class-graduate": "/lottie/class-graduate.json",
  "exam-pass": "/lottie/exam-pass.json",
  "achievement-unlock": "/lottie/achievement-unlock.json",
  "streak-milestone": "/lottie/streak-milestone.json",
};

/** Dev placeholders — colored shapes only; never overlay until GA exports land. */
const PLACEHOLDER_ASSETS = new Set<LottieAsset>([
  "lesson-complete",
  "class-graduate",
  "exam-pass",
  "achievement-unlock",
  "streak-milestone",
]);

/**
 * Lazy-loaded Lottie — static fallback always paints first; animation overlays
 * only when a non-placeholder JSON loads. Skipped when reduced-motion.
 */
export function LazyLottie({
  asset,
  className,
  loop = false,
  children,
}: {
  asset: LottieAsset;
  className?: string;
  loop?: boolean;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<object | null>(null);
  const isPlaceholder = PLACEHOLDER_ASSETS.has(asset);

  useEffect(() => {
    if (reduced || isPlaceholder) return;
    let cancelled = false;
    fetch(SRC[asset])
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [asset, reduced, isPlaceholder]);

  const showLottie = !reduced && !isPlaceholder && data;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {children}
      {showLottie && (
        <Lottie
          animationData={data}
          loop={loop}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        />
      )}
    </div>
  );
}
