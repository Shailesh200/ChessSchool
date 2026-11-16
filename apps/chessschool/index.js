// Crash capture first, then the router: an error while the app's own modules load still reaches Sentry.
import "./lib/boot";
import "expo-router/entry";
