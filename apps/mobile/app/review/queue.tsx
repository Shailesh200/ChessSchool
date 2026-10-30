import { PremiumReviewScreen } from "@/screens/premium/PremiumReviewScreen";
import { useUiKit } from "@/components/kit";
import { Redirect } from "expo-router";

export default function ReviewQueueRoute() {
  const kit = useUiKit();
  if (kit !== "premium") return <Redirect href="/(tabs)/review" />;
  return <PremiumReviewScreen mode="queue" />;
}
