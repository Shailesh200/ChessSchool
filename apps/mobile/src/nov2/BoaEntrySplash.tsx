import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KitButton, KitLogo } from "@/components/kit";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "@/nov2/premiumTokens";

/** 01-splash — illustrated entry with CTA to onboarding or login. */
export function BoaEntrySplash() {
  const router = useRouter();

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: premiumColors.bgSplash },
  inner: { flex: 1, padding: premiumSpace[5], gap: premiumSpace[5], justifyContent: "center" },
  hero: {
    backgroundColor: premiumColors.brandSoft,
    borderRadius: premiumRadius.x2,
    paddingVertical: premiumSpace[10],
    alignItems: "center",
  },
  act: { gap: premiumSpace[3], alignItems: "center" },
  h1: {
    ...premiumType.h1,
    fontFamily: premiumFont.display,
    color: premiumColors.text,
    textAlign: "center",
    maxWidth: 340,
  },
  sub: {
    ...premiumType.bodyLg,
    fontFamily: premiumFont.ui,
    color: premiumColors.textMuted,
    textAlign: "center",
    maxWidth: 340,
  },
  btns: { width: "100%", maxWidth: 390, gap: premiumSpace[2], marginTop: premiumSpace[2] },
});
