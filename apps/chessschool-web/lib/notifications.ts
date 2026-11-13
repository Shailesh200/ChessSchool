import type { NotificationStatus } from "@chessschool/design";

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/** Asks the browser once. A prior "denied" is reported without prompting again. */
export async function requestNotifications(): Promise<NotificationStatus> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result === "granted" ? "granted" : result === "denied" ? "denied" : "dismissed";
}
