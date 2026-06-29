"use client";

import { useRouter } from "next/navigation";
import { cn } from "./cn";
import { startNav } from "@/core/store/nav.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

/** Consistent Back control for secondary pages (#nav). */
export function BackButton({
  label = "Back",
  fallback = "/profile",
  className,
}: {
  label?: string;
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        haptics.fire("tap");
        audio.play("transition");
        startNav();
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      aria-label={label}
      className={cn(
        "btn-tactile inline-flex items-center gap-1.5 self-start rounded-pill border border-hairline bg-surface-card px-3.5 py-2 text-sm font-bold text-ink-700 [box-shadow:var(--shadow-card)] hover:text-brand",
        className,
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
