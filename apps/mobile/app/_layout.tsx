import "@/sentry";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { ScreenLoader } from "@/ScreenLoader";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import { AuthProvider, useAuth } from "@/auth";
import { ThemeProvider, useAppTheme } from "@/ThemeProvider";
import { PremiumKitThemeProvider } from "@/components/kit";
import { useKitFonts } from "@/theme/premium/kitFonts";
import { AnimatedSplash } from "@/AnimatedSplash";
import { ErrorBoundary } from "@/ErrorBoundary";
import { NetworkProvider } from "@/NetworkProvider";
import { NetworkBanner } from "@/NetworkBanner";
import { Toaster } from "@/Toaster";
import { UpdateBanner } from "@/UpdateBanner";
import { Diagnostics } from "@/Diagnostics";
import { PageViewTracker } from "@/productAnalytics/PageViewTracker";
import { wrapRoot } from "@/sentry";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const ACADEMY = "/(tabs)/academy" as const;

function Gate() {
  const { user, guest, loading, needsOnboarding, orientationDone, enterGuestBrowse } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const nav = useRootNavigationState();

  useEffect(() => {
    // Never navigate until the root navigator is mounted — otherwise expo-router
    // throws "Attempted to navigate before mounting the Root Layout" (uncaught).
    if (loading || !nav?.key) return;

    try {
      const root = segments[0] as string | undefined;
      const onOrientation = root === undefined || root === "index";
      const onLogin = root === "login";
      const onOnboarding = root === "onboarding";
      const onWelcome = root === "welcome";

      if (user && !guest) {
        if (needsOnboarding && !onOnboarding) router.replace("/onboarding");
        else if (!needsOnboarding && onWelcome) return;
        else if (!needsOnboarding && (onLogin || onOrientation)) router.replace("/welcome");
        return;
      }

      const onParityAuth = root === "parity-auth";
      if (onParityAuth) return;
      if (root === "ace-preview" && process.env.EXPO_PUBLIC_ACE_PREVIEW === "1") return;

      // Parity deep-links arrive before orientation completes — enter guest and continue.
      // Never call this once a real session exists (account / signed-in captures).
      if (
        process.env.EXPO_PUBLIC_PARITY === "1" &&
        !orientationDone &&
        !onOrientation &&
        !(user && !guest)
      ) {
        enterGuestBrowse();
      }

      if (guest && user) {
        // Guests must reach /login to enroll (My ID → login) — do not bounce them away.
        if (onLogin) return;
        if (onOrientation || onOnboarding) router.replace(ACADEMY);
        return;
      }

      if (!orientationDone) {
        if (!onOrientation) router.replace("/");
        return;
      }

      if (onLogin) return;

      if (onOrientation) {
        enterGuestBrowse();
        router.replace(ACADEMY);
      }
    } catch {
      /* fail open — stay on the current route */
    }
  }, [
    user,
    guest,
    loading,
    needsOnboarding,
    orientationDone,
    segments,
    router,
    enterGuestBrowse,
    nav?.key,
  ]);

  // Always mount Stack so navigation is ready while auth resolves.
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {loading ? <ScreenLoader variant="fullscreen" label="Opening the academy…" /> : null}
    </>
  );
}

function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const kitFontsLoaded = useKitFonts();

  const finishSplash = useCallback(() => setShowSplash(false), []);
  const ready = (fontsLoaded || fontsTimedOut) && (kitFontsLoaded || fontsTimedOut);

  useEffect(() => {
    // Release APKs can hang forever on font CDN misses — fail open so the app boots.
    const t = setTimeout(() => setFontsTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <PremiumKitThemeProvider>
            <NetworkProvider>
            <ThemedStatusBar />
            <NetworkBanner />
            <UpdateBanner />
            <Toaster />
            <AuthProvider>
              {/* Diagnostics uses useAuth — must stay inside AuthProvider. */}
              <Diagnostics />
              <PageViewTracker />
              <Gate />
            </AuthProvider>
          </NetworkProvider>
          </PremiumKitThemeProvider>
        </ThemeProvider>
        {showSplash ? (
          <View style={styles.splashOverlay} pointerEvents="auto">
            <StatusBar style="dark" />
            <AnimatedSplash onFinish={finishSplash} />
          </View>
        ) : null}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});

export default wrapRoot(RootLayout);
