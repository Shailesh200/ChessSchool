import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import { settings } from "./settings";

/** Haptic feedback (native only; no-ops on web or when disabled in settings). */
function safe(fn: () => Promise<unknown>, androidMs = 20) {
  if (Platform.OS === "web" || !settings.get().haptics) return;
  if (Platform.OS === "android") {
    try {
      Vibration.vibrate(androidMs);
    } catch {
      /* ignore */
    }
  }
  fn().catch(() => void 0);
}

export const haptics = {
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 18),
  select: () => safe(() => Haptics.selectionAsync(), 12),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 30),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 40),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 45),
};
