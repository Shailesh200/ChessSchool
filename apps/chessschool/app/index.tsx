import { copy, motion } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect } from "react";
import { Image, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Cody, Fx } from "@/components/Lottie";
import { T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

export default function Splash() {
  const { state } = useApp();
  const { c } = useTheme();

  useEffect(() => {
    const dest = state.account || state.seenWelcome ? "/today" : "/welcome";
    const t = setTimeout(() => router.replace(dest), motion.duration.splash);
    return () => clearTimeout(t);
  }, [state.account, state.seenWelcome]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }} accessibilityLabel={copy.splash.loading}>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <Fx name="splash-mark" size={120} style={{ marginRight: -24 }} />
        <Cody animation="wave" size={150} label={copy.a11y.mascot} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image source={require("@chessschool/design/assets/raster/favicon-48.png")} style={{ width: 40, height: 40, borderRadius: 12 }} accessibilityIgnoresInvertColors />
        <T role="title">
          Chess<T role="title" color="brandText">School</T>
        </T>
      </View>
      <T role="body" color="textMuted" center style={{ maxWidth: 280 }}>
        {copy.tagline}
      </T>
    </SafeAreaView>
  );
}
