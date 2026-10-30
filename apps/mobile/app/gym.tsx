import { View } from "react-native";
import { KitBottomNav, useUiKit } from "@/components/kit";
import { PremiumGymScreen } from "@/screens/premium/PremiumGymScreen";
import { Redirect } from "expo-router";

export default function GymRoute() {
  const kit = useUiKit();
  if (kit !== "premium") return <Redirect href="/(tabs)/academy" />;
  return (
    <View style={{ flex: 1 }}>
      <PremiumGymScreen />
      <KitBottomNav />
    </View>
  );
}
