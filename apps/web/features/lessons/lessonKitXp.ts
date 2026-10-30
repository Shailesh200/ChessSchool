import type { KitLottieId } from "@/components/motion/KitLottie";

/** Kit 08 uses xp-pop-20 / xp-pop-50 variants by total XP earned. */
export function kitXpPopLottieId(totalXp: number): KitLottieId {
  if (totalXp >= 50) return "xp-pop-50";
  if (totalXp >= 20) return "xp-pop-20";
  return "xp-pop";
}

export function formatLessonDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
