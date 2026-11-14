import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from "@expo-google-fonts/atkinson-hyperlegible";
import { Baloo2_400Regular, Baloo2_500Medium, Baloo2_600SemiBold, Baloo2_700Bold } from "@expo-google-fonts/baloo-2";
import { Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from "@expo-google-fonts/fredoka";
import { copy, newBadges } from "@chessschool/design";
import { router, Stack } from "expo-router";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ReducedMotionConfig, ReduceMotion } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UpdateBanner } from "@/components/UpdateBanner";
import { ToastProvider, useToast } from "@/components/ui";
import { usePuzzlePackBoot } from "@/lib/puzzlePack";
import { useReducedMotion } from "@/lib/hooks";
import { AppStateProvider, useApp } from "@/lib/state";
import { ThemeProvider, useTheme } from "@/lib/theme";

// Crash reports only, no personal data. The DSN comes from the EAS production environment, so dev and QA builds without it send nothing.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) Sentry.init({ dsn: sentryDsn, sendDefaultPii: false, tracesSampleRate: 0, enabled: !__DEV__, initialScope: { tags: { service: "app" } } });

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { state, ready } = useApp();
  usePuzzlePackBoot();
  const [fontsLoaded, fontError] = useFonts({ Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold, Baloo2_400Regular, Baloo2_500Medium, Baloo2_600SemiBold, Baloo2_700Bold, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const loaded = ready && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  return (
    <ThemeProvider appearance={state.prefs.appearance} theme={state.prefs.theme} board={state.prefs.boardColors}>
      <Themed>{loaded ? <Routes /> : null}</Themed>
    </ThemeProvider>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const { c, scheme } = useTheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);
  return (
    <ToastProvider>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
      <UpdateBanner />
    </ToastProvider>
  );
}

/** Tapping a daily reminder opens Learn. */
function useReminderTaps(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    try {
      const Notifications = require("expo-notifications") as typeof import("expo-notifications");
      const sub = Notifications.addNotificationResponseReceivedListener((r) => {
        const url = r.notification.request.content.data?.url;
        if (typeof url === "string") router.push(url as "/today");
      });
      return () => sub.remove();
    } catch {
      return;
    }
  }, [enabled]);
}

/** Celebrates each newly earned achievement once, wherever the learner is. */
function useBadgeToasts() {
  const { state, ready, markBadgesSeen, cue } = useApp();
  const toast = useToast();
  const fresh = ready ? newBadges(state).join(",") : "";
  useEffect(() => {
    if (!fresh) return;
    const ids = fresh.split(",");
    const t = setTimeout(() => {
      for (const id of ids) toast(`${copy.badges.earned} ${copy.badges.list[id].name}`);
      cue("level-up");
      markBadgesSeen(ids);
    }, 1200);
    return () => clearTimeout(t);
  }, [fresh, toast, cue, markBadgesSeen]);
}

function Routes() {
  const { c } = useTheme();
  const { state } = useApp();
  const reduced = useReducedMotion();
  useReminderTaps(state.prefs.notifications === "granted");
  useBadgeToasts();
  // Reduce motion: screens cross-fade instead of sliding, and every Reanimated animation jumps to its end.
  const slide = reduced ? "fade" : "slide_from_bottom";
  return (
    <>
      <ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.System} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: reduced ? "fade" : "slide_from_right" }}>
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="welcome" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="orientation" options={{ animation: slide, presentation: "fullScreenModal" }} />
        <Stack.Screen name="lesson/[id]" options={{ animation: slide, presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="practice/session" options={{ animation: slide, presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="puzzle" options={{ animation: slide, presentation: "fullScreenModal" }} />
        <Stack.Screen name="sprint" options={{ animation: slide, presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="terms" options={{ presentation: "modal" }} />
        <Stack.Screen name="report" options={{ presentation: "modal" }} />
        <Stack.Screen name="learners" />
        <Stack.Screen name="placement" options={{ animation: slide, presentation: "fullScreenModal", gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <Root />
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
