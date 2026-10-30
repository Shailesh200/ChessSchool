import { useMemo } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KitButton, KitLogo, usePremiumKitTheme } from "@/components/kit";
import { createSplashStyles } from "@/nov2/premiumKitStyles";

/** 01-splash — illustrated entry with CTA to onboarding or login. */
export function BoaEntrySplash() {
  const router = useRouter();
  const kit = usePremiumKitTheme();
  const styles = useMemo(() => createSplashStyles(kit), [kit]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="boa-entry-splash">
      <View style={styles.inner}>
        <View style={styles.hero}>
          <KitLogo withText size={32} />
        </View>
        <View style={styles.act}>
          <Text style={styles.h1}>Learn chess with a coach who has your back.</Text>
          <Text style={styles.sub}>Short lessons, kind feedback, no pressure.</Text>
          <View style={styles.btns}>
            <KitButton label="Get started" variant="accent" onPress={() => router.push("/boa/onboarding")} testID="boa-get-started" />
            <KitButton label="I already have an account" variant="ghost" onPress={() => router.push("/login")} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
