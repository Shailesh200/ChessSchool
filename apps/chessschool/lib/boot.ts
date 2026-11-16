import * as Sentry from "@sentry/react-native";
import { installFatalHandler } from "./crash";

// Runs before any route module (see index.js), so even an error while the app's code loads is caught.
// Our fatal handler goes in first so Sentry's wraps it: Sentry writes a fatal error to disk natively (sent on the
// next launch, even if the app dies at startup), then ours shows the friendly Restart screen.
installFatalHandler();

// Crash reports only, no personal data. The DSN comes from the EAS production environment, so dev and QA builds without it send nothing.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn)
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enabled: !__DEV__,
    initialScope: { tags: { service: "app" } },
    // Native crash capture and the on-disk envelope cache (both SDK defaults, stated so nobody turns them off):
    // events wait on the device while offline or after a crash and go out on the next launch.
    enableNative: true,
    enableNativeCrashHandling: true,
    maxCacheItems: 30,
    // Release health sessions: the OTA rollout guard reads the crash-free session rate from these.
    enableAutoSessionTracking: true,
  });

