import type { ComponentType } from "react";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const version = Constants.expoConfig?.version ?? "0.0.0";
const versionCode = Constants.expoConfig?.android?.versionCode ?? 0;

/**
 * JS-first Sentry. Native crash handler is off for release stability —
 * a misconfigured NDK/session path was crashing the production AAB on launch.
 * JS exceptions (ErrorBoundary, captureException) still report when DSN is set.
 */
try {
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    enableNative: false,
    enableNativeCrashHandling: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    release: `com.chessschool.app@${version}+${versionCode}`,
    dist: String(versionCode),
  });
} catch (err) {
  console.warn("[sentry] init failed", err);
}

export { Sentry };

/** Wrap root only when DSN is present; never throw if wrap fails. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapRoot(Component: ComponentType<any>): ComponentType<any> {
  if (!dsn) return Component;
  try {
    // Sentry typings are stricter than Expo Router's root component.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Sentry.wrap(Component as any);
  } catch {
    return Component;
  }
}
