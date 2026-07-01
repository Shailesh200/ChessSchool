"use client";

/**
 * Haptics abstraction — wraps the Vibration API behind intent-named methods so
 * UI code never touches raw durations. No-ops gracefully where unsupported
 * (most desktop browsers, iOS Safari) and when the user disables haptics.
 */

export type HapticPattern = "tap" | "success" | "error" | "select" | "heavy";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  select: 6,
  success: [12, 40, 18],
  error: [30, 30, 30],
  heavy: 24,
};

let enabled = true;

export const haptics = {
  setEnabled(v: boolean) {
    enabled = v;
  },
  fire(pattern: HapticPattern) {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      /* unsupported — ignore */
    }
  },
};
