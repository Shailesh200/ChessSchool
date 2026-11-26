import { copy, palettes, reminderMood, reminderPlan, reminderText, type LocalState, type NotificationStatus } from "@chessschool/design";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { File, Paths } from "expo-file-system";
import { Image, Linking, Platform } from "react-native";

// Loaded on demand: importing it at startup warns in Expo Go.
const load = () => require("expo-notifications") as typeof import("expo-notifications");

/** Asks the OS once. If the learner said no before, we only report it and never re-prompt. */
export async function requestNotifications(): Promise<NotificationStatus> {
  try {
    const Notifications = load();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    if (!current.canAskAgain) return "denied";
    const next = await Notifications.requestPermissionsAsync();
    return next.granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

const CHANNEL = "daily";
const BRAND = palettes.light.accent;

/**
 * Chaukor's picture for one iOS reminder. iOS moves an attachment's file into its own store, so each
 * reminder gets its own copy. Null in development (the asset is served by Metro, not on disk).
 */
function chaukorPicture(i: number): string | null {
  if (Platform.OS !== "ios") return null;
  try {
    const src = Image.resolveAssetSource(require("../assets/notifications/chaukor.png")).uri;
    if (!src.startsWith("file:")) return null;
    const copyTo = new File(Paths.cache, `reminder-${Date.now()}-${i}.png`);
    new File(src).copy(copyTo);
    return copyTo.uri;
  } catch {
    return null;
  }
}

/**
 * Replaces the scheduled reminders with the next week's plan. Called whenever progress or the
 * reminder settings change, so a finished goal cancels today's nudge.
 */
export async function syncReminders(state: LocalState): Promise<void> {
  // Never asked or refused: nothing to schedule. Expo Go can't schedule reliably and logs an error
  // when the module loads, so scheduled reminders need a development or store build.
  if (state.prefs.notifications === "unknown" || state.prefs.notifications === "denied") return;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  try {
    const Notifications = load();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (state.prefs.notifications !== "granted") return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: copy.settings.notifications, importance: Notifications.AndroidImportance.DEFAULT, lightColor: BRAND });
    }
    const plan = reminderPlan(state, new Date());
    for (const [i, date] of plan.entries()) {
      const picture = chaukorPicture(i);
      await Notifications.scheduleNotificationAsync({
        content: {
          ...reminderText(reminderMood(state, date, i === plan.length - 1), state.profile.name, date.getDate()),
          data: { url: "/today" },
          color: BRAND,
          ...(picture ? { attachments: [{ identifier: "chaukor", url: picture, type: "public.png" }] } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
      });
    }
  } catch {
    // Reminders are a nicety; never let scheduling break the app.
  }
}

export const openSystemSettings = () => Linking.openSettings();

/** This device's Expo push token for the weekly summary, or null (no permission, Expo Go, or no push setup). */
export async function pushToken(): Promise<string | null> {
  try {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
    const N = load();
    if ((await N.getPermissionsAsync()).status !== "granted") return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    return (await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch {
    return null;
  }
}
