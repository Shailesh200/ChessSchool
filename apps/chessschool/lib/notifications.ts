import { copy, dayKey, reminderPlan, visibleStreak, type LocalState, type NotificationStatus } from "@chessschool/design";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Linking, Platform } from "react-native";

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
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: copy.settings.notifications, importance: Notifications.AndroidImportance.DEFAULT });
    }
    const now = new Date();
    const streak = visibleStreak(state.progress.streak, dayKey(now));
    const name = state.profile.name.trim();
    for (const [i, date] of reminderPlan(state, now).entries()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: copy.reminders.titles[(date.getDate() + i) % copy.reminders.titles.length],
          body: streak && i === 0 ? copy.reminders.streakBody(streak) : copy.reminders.body(name),
          data: { url: "/today" },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
      });
    }
  } catch {
    // Reminders are a nicety; never let scheduling break the app.
  }
}

export const openSystemSettings = () => Linking.openSettings();
