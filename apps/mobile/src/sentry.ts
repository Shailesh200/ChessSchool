import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const version = Constants.expoConfig?.version ?? "0.0.0";
const versionCode = Constants.expoConfig?.android?.versionCode ?? 0;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  sendDefaultPii: false,
  // Free Developer plan — keep traces low in production.
  tracesSampleRate: __DEV__ ? 1.0 : 0.05,
  enableAutoSessionTracking: true,
  release: `com.chessschool.app@${version}+${versionCode}`,
  dist: String(versionCode),
});

export { Sentry };
