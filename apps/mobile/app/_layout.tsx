import { useCallback, useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
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
import { AnimatedSplash } from "@/AnimatedSplash";
import { ErrorBoundary } from "@/ErrorBoundary";
import { NetworkProvider } from "@/NetworkProvider";
import { NetworkBanner } from "@/NetworkBanner";
import { Toaster } from "@/Toaster";
import { UpdateBanner } from "@/UpdateBanner";
import { Diagnostics } from "@/Diagnostics";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const ACADEMY = "/(tabs)/academy" as const;

function Gate() {
  const { user, guest, loading, needsOnboarding, orientationDone, enterGuestBrowse } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
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
      // Parity credential deep-links must reach LoginScreen; guest Gate would
      // otherwise bounce /login straight back to Academy before auto-submit.
      if (onLogin && process.env.EXPO_PUBLIC_PARITY === "1") return;
      if (onOrientation || onOnboarding || onLogin) router.replace(ACADEMY);
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
  }, [user, guest, loading, needsOnboarding, orientationDone, segments, router, enterGuestBrowse]);

  if (loading) {
    return <ScreenLoader variant="fullscreen" label="Opening the academy…" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  const finishSplash = useCallback(() => setShowSplash(false), []);
  const ready = fontsLoaded || fontsTimedOut;

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

  if (showSplash) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AnimatedSplash onFinish={finishSplash} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NetworkProvider>
          <ThemedStatusBar />
          <NetworkBanner />
          <UpdateBanner />
          <Toaster />
          <Diagnostics />
          <AuthProvider>
            <ErrorBoundary>
              <Gate />
            </ErrorBoundary>
          </AuthProvider>
        </NetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
