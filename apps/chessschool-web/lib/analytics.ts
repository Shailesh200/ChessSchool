import { createPulse, language, type PulseEvent } from "@chessschool/design";
import { PULSE_ORIGIN } from "@shailesh200/pulse-tracker";

/**
 * Pulse product analytics for the website. Off (a no-op) without NEXT_PUBLIC_PULSE_WEBSITE_ID, while
 * "Share anonymous usage" is off in Settings, and when the browser sends Do Not Track.
 * Property rules (ids and numbers only, no names, emails or free text) live in @chessschool/design pulse.ts.
 */
let allowed = false;

const pulse = createPulse({
  websiteId: process.env.NEXT_PUBLIC_PULSE_WEBSITE_ID,
  origin: process.env.NEXT_PUBLIC_PULSE_ORIGIN ?? PULSE_ORIGIN,
  hostname: typeof window === "undefined" ? "www.chess-school.in" : window.location.hostname,
  post: (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "omit" }),
  enabled: () => allowed && typeof navigator !== "undefined" && navigator.doNotTrack !== "1",
  language,
  screen: () => (typeof window === "undefined" ? "" : `${window.screen.width}x${window.screen.height}`),
});

/** Called by the app state whenever the "Share anonymous usage" switch is read or changed. */
export function setAnalyticsAllowed(on: boolean) {
  allowed = on;
  if (!on) pulse.clear();
}

export const track = (name: PulseEvent, props?: Record<string, unknown>) => pulse.event(name, props);
export const trackScreen = (path: string) => pulse.screen(path);
export const flushAnalytics = () => void pulse.flush();
