import { identify, track, type TrackProps } from "@shailesh200/pulse-tracker";
import { useSettings } from "@/core/store/settings.store";

const DEVICE_KEY = "pulse.device_id";

/** Anonymous first-party device id. 0.1.0 of the tracker does not export this. */
function deviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/** Umami website id — override with NEXT_PUBLIC_PULSE_WEBSITE_ID. */
export const PULSE_WEBSITE_ID =
  process.env.NEXT_PUBLIC_PULSE_WEBSITE_ID ??
  "4bb7a0af-823c-4a21-a4ab-509a7815cf02";

export const PULSE_ORIGIN =
  process.env.NEXT_PUBLIC_PULSE_ORIGIN ?? "https://pulse.shaileshjha.in";

const SKIP_PULSE = new Set(["page_view", "game_end", "bot_game_start"]);

export function pulseAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.doNotTrack === "1") return false;
  if (!useSettings.getState().shareAnalytics) return false;
  return true;
}

export function pulseDomains(): string | undefined {
  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (process.env.NODE_ENV !== "production") {
    return "chess-school.in,www.chess-school.in,localhost,127.0.0.1";
  }
  if (vercelEnv && vercelEnv !== "production") {
    return undefined;
  }
  return "chess-school.in,www.chess-school.in";
}

function flatten(props?: Record<string, unknown>): TrackProps | undefined {
  if (!props) return undefined;
  const out: TrackProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** Pulse-only custom event (does not hit the first-party warehouse). */
export function pulseTrack(name: string, props?: Record<string, unknown>): void {
  if (!pulseAllowed()) return;
  if (SKIP_PULSE.has(name)) return;
  track(name, flatten(props));
}

export function pulseIdentify(user: {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}): void {
  if (!pulseAllowed()) return;
  const data: TrackProps = {
    platform: "web",
    device_id: deviceId(),
  };
  if (user.email) data.email = user.email;
  if (user.name) data.name = user.name;
  if (user.role) data.role = user.role;
  identify(user.id, data);
}

export const PULSE_PENDING_AUTH = "pulse.pending_auth";
