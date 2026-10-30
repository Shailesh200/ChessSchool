import { useUiKit } from "@/components/kit/useUiKit";
import { PremiumNotificationsScreen } from "@/screens/premium/PremiumNotificationsScreen";
import { Redirect } from "expo-router";

export default function NotificationsRoute() {
  const kit = useUiKit();
  if (kit !== "premium") return <Redirect href="/settings" />;
  return <PremiumNotificationsScreen />;
}
