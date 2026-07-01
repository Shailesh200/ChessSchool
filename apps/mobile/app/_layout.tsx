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
import { UpdateBanner } from "@/UpdateBanner";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate() {
  const { user, loading, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    const onOnboarding = segments[0] === "onboarding";
    if (!user && !onLogin) router.replace("/login");
    else if (user && needsOnboarding && !onOnboarding) router.replace("/onboarding");
    else if (user && !needsOnboarding && (onLogin || onOnboarding)) router.replace("/(tabs)");
  }, [user, loading, needsOnboarding, segments]);

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
