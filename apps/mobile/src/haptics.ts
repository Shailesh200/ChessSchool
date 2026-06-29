import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { settings } from "./settings";

/** Haptic feedback (native only; no-ops on web or when disabled in settings). */
function safe(fn: () => Promise<unknown>) {
  if (Platform.OS === "web" || !settings.get().haptics) return;
  fn().catch(() => void 0);
}

export const haptics = {
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};
