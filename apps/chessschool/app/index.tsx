import { copy, motion, startRoute } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect } from "react";

import { SafeAreaView } from "react-native-safe-area-context";
import { Cody } from "@/components/Lottie";
import { T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

export default function Splash() {
  const { ready, state } = useApp();
  const { c } = useTheme();

  useEffect(() => {
    if (!ready) return;
    // A new install goes straight into the first lesson; welcome and the account offer come after it.
    const dest = startRoute(state);
    const t = setTimeout(() => router.replace(dest as "/today"), dest === "/today" ? motion.duration.splash : 300);
    return () => clearTimeout(t);
    // Decided once, when the saved state has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }} accessibilityLabel={copy.splash.loading}>
      <Cody animation="wave" size={180} label={copy.a11y.mascot} />
      <T role="title">
        Chess<T role="title" color="brandText">School</T>
      </T>
      <T role="body" color="textMuted" center style={{ maxWidth: 280 }}>
        {copy.tagline}
      </T>
    </SafeAreaView>
  );
}
