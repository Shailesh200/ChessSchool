import { getAchievement } from "@/features/progression/achievements";
import { useProgression } from "@/core/store/progression.store";
import { toast } from "@/core/store/toast.store";

/** Unlock an achievement and show the celebration toast (MOTION.md #4). */
export function unlockAndCelebrate(id: string): boolean {
  const unlocked = useProgression.getState().unlockAchievement(id);
  if (!unlocked) return false;
  const a = getAchievement(id);
  toast(a ? `${a.title} unlocked!` : "Achievement unlocked!", {
    icon: "trophy",
    tone: "success",
    lottie: "achievement-unlock",
    sticky: true,
  });
  return true;
}
