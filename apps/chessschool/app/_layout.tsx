import { Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from "@expo-google-fonts/fredoka";
import { copy, newBadges } from "@chessschool/design";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider, useToast } from "@/components/ui";
import { AppStateProvider, useApp } from "@/lib/state";
import { ThemeProvider, useTheme } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { state, ready } = useApp();
  const [fontsLoaded, fontError] = useFonts({ Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold });
  const loaded = ready && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  return (
    <ThemeProvider appearance={state.prefs.appearance} theme={state.prefs.theme}>
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
  useReminderTaps(state.prefs.notifications === "granted");
  useBadgeToasts();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "slide_from_right" }}>
      <Stack.Screen name="index" options={{ animation: "fade" }} />
      <Stack.Screen name="welcome" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="orientation" options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }} />
      <Stack.Screen name="lesson/[id]" options={{ animation: "slide_from_bottom", presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="practice/session" options={{ animation: "slide_from_bottom", presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="puzzle" options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }} />
      <Stack.Screen name="sprint" options={{ animation: "slide_from_bottom", presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="terms" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Root />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
