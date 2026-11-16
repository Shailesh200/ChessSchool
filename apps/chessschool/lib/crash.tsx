import { copy } from "@chessschool/design";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { Component, useSyncExternalStore, type ReactNode } from "react";
import { Alert, DevSettings, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";

/**
 * Fatal JS errors show a friendly "Restart" screen instead of closing the app, and reach Sentry even when the app
 * dies right after: Sentry's own global handler marks a fatal error as a hard crash, which the native SDK writes
 * to disk and sends on the next launch. That needs `installFatalHandler()` to run BEFORE `Sentry.init`, so Sentry
 * wraps our handler (Sentry stores the crash, then calls us). Render errors never reach ErrorUtils in RN 0.81,
 * so `FatalBoundary` catches those and stores them the same way.
 */

// Technical detail only outside the production channel (dev, preview, QA builds).
const showDetail = Updates.channel !== "production";

let fatal: Error | null = null;
let boundaries = 0;
const listeners = new Set<() => void>();
const setFatal = (e: Error) => ((fatal = e), listeners.forEach((l) => l()));
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));
const detail = (e: Error) => `${e.name}: ${e.message}\n\n${String(e.stack ?? "").split("\n").slice(0, 8).join("\n")}`;

export function restart() {
  // reloadAsync rejects when expo-updates is off (simulator and test builds); RN can still reload the bundle.
  Updates.reloadAsync().catch(() => DevSettings.reload());
}

export function installFatalHandler() {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) return defaultHandler(error, isFatal);
    const e = asError(error);
    void SplashScreen.hideAsync().catch(() => {});
    if (boundaries > 0) return setFatal(e);
    // Before React has mounted: a native dialog is all we have.
    const s = copy.system;
    Alert.alert(s.crashTitle, showDetail ? `${s.crashBody}\n\n${detail(e)}` : s.crashBody, [{ text: s.restart, onPress: restart }], { cancelable: false });
  });
}

/** Stores a render crash the way Sentry stores an uncaught fatal (hard crash: written to disk natively). */
function captureFatal(error: Error) {
  Sentry.withScope((scope) => {
    scope.setLevel("fatal");
    Sentry.captureException(error, { mechanism: { handled: false, type: "onerror" } });
  });
}

export class FatalBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error: asError(error) };
  }
  componentDidMount() {
    boundaries++;
  }
  componentWillUnmount() {
    boundaries--;
  }
  componentDidCatch(error: unknown) {
    captureFatal(asError(error));
    void SplashScreen.hideAsync().catch(() => {});
  }
  render() {
    return <Fatal error={this.state.error}>{this.props.children}</Fatal>;
  }
}

function Fatal({ error, children }: { error: Error | null; children: ReactNode }) {
  const global = useSyncExternalStore(subscribe, () => fatal);
  const shown = error ?? global;
  return shown ? <CrashScreen error={shown} /> : children;
}

/** Plain colours and system fonts: this has to render even when the theme or fonts are what broke. */
function CrashScreen({ error }: { error: Error }) {
  const dark = useColorScheme() === "dark";
  const fg = dark ? "#F3F2FF" : "#1E1B4B";
  const s = copy.system;
  return (
    <View accessibilityRole="alert" style={{ flex: 1, backgroundColor: dark ? "#14152B" : "#FBFAFF", justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ color: fg, fontSize: 24, fontWeight: "700", textAlign: "center" }}>{s.crashTitle}</Text>
      <Text style={{ color: fg, fontSize: 17, textAlign: "center", opacity: 0.8 }}>{s.crashBody}</Text>
      <Pressable accessibilityRole="button" onPress={restart} style={{ minHeight: 56, borderRadius: 999, backgroundColor: "#5B5BD6", alignItems: "center", justifyContent: "center", marginTop: 8 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>{s.restart}</Text>
      </Pressable>
      {showDetail ? (
        <ScrollView style={{ maxHeight: 240 }}>
          <Text selectable style={{ color: fg, fontSize: 12, fontFamily: "Courier", opacity: 0.7 }}>
            {detail(error)}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}
