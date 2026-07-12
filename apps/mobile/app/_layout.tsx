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

    if (user && !guest) {
      if (needsOnboarding && !onOnboarding) router.replace("/onboarding");
      else if (!needsOnboarding && (onLogin || onOrientation)) router.replace(ACADEMY);
      return;
    }

    if (guest && user) {
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
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  const finishSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
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
