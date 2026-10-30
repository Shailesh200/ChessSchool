import { useUiKit } from "@/components/kit/useUiKit";
import { PremiumNotificationsSavedScreen } from "@/screens/premium/PremiumNotificationsScreen";
import { Redirect } from "expo-router";

export default function NotificationsSavedRoute() {
  const kit = useUiKit();
  if (kit !== "premium") return <Redirect href="/settings" />;
  return <PremiumNotificationsSavedScreen />;
}
