import { copy, isNewerVersion } from "@chessschool/design";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/lib/api";
import { fonts, useTheme } from "@/lib/theme";
import { T } from "./ui";

const STORE = Platform.select({
  ios: "itms-beta://",
  default: "market://details?id=com.chessschool.app",
});
const STORE_WEB = Platform.select({
  ios: "https://apps.apple.com/app/id6828715695",
  default: "https://play.google.com/store/apps/details?id=com.chessschool.app",
});

/** A bar when a store build or an over-the-air update is newer than this install. */
export function UpdateBanner() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<null | "store" | "ota">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const local = Constants.expoConfig?.version ?? "0.0.0";
      if (API_URL) {
        try {
          const res = await fetch(`${API_URL}/v1/health`);
          const body = (await res.json()) as { app?: string };
          if (!cancel && body.app && isNewerVersion(body.app, local)) {
            setKind("store");
            return;
          }
        } catch {
          // Offline: the store check can wait until the next launch.
        }
      }
      if (__DEV__) return;
      try {
        const Updates = await import("expo-updates");
        if (!Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (!cancel && check.isAvailable) setKind("ota");
      } catch {
        // No published update channel in this build.
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (!kind) return null;

  const go = async () => {
    if (kind === "store") {
      await Linking.openURL(STORE!).catch(() => Linking.openURL(STORE_WEB!));
      return;
    }
    setBusy(true);
    try {
      const Updates = await import("expo-updates");
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setBusy(false);
    }
  };

  return (
    <View
      accessibilityRole="summary"
      style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: c.brand, flexDirection: "row", alignItems: "center", gap: 10 }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T role="label" style={{ color: c.onBrand }}>{copy.update.title}</T>
        <T role="small" style={{ color: c.onBrand }}>{kind === "store" ? copy.update.store : copy.update.ota}</T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.update.later} onPress={() => setKind(null)} hitSlop={8}>
        <T role="small" style={{ color: c.onBrand, fontFamily: fonts.semibold }}>{copy.update.later}</T>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.update.action} disabled={busy} onPress={() => void go()} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: c.card }}>
        <T role="label" color="brandText">{busy ? copy.auth.working : copy.update.action}</T>
      </Pressable>
    </View>
  );
}
