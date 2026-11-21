import { createPulse, language, type PulseEvent } from "@chessschool/design";
import { PULSE_ORIGIN } from "@shailesh200/pulse-tracker";
import Constants from "expo-constants";
import { Dimensions, Platform } from "react-native";

/**
 * Pulse product analytics for the app. Off (a no-op) without EXPO_PUBLIC_PULSE_WEBSITE_ID and while
 * "Share anonymous usage" is off in Settings. Property rules (ids and numbers only, no names, emails or
 * free text) live in @chessschool/design pulse.ts.
 */
let allowed = false;
const version = Constants.expoConfig?.version ?? "0";
// Pulse drops requests that look like bots; a plain browser-style agent names the platform for its reports.
const agent = Platform.OS === "ios" ? `Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X) ChessSchool/${version}` : `Mozilla/5.0 (Linux; Android) ChessSchool/${version}`;

const pulse = createPulse({
  websiteId: process.env.EXPO_PUBLIC_PULSE_WEBSITE_ID,
  origin: process.env.EXPO_PUBLIC_PULSE_ORIGIN ?? PULSE_ORIGIN,
  hostname: `${Platform.OS}.app.chess-school.in`,
  post: (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": agent }, body }),
  enabled: () => allowed,
  language,
  screen: () => {
    const { width, height } = Dimensions.get("screen");
    return `${Math.round(width)}x${Math.round(height)}`;
  },
});

export function setAnalyticsAllowed(on: boolean) {
  allowed = on;
  if (!on) pulse.clear();
}

export const track = (name: PulseEvent, props?: Record<string, unknown>) => pulse.event(name, props);
export const trackScreen = (path: string) => pulse.screen(path);
export const flushAnalytics = () => void pulse.flush();
