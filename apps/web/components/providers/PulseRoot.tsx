"use client";

import { Pulse } from "@shailesh200/pulse-tracker/react";
import { useEffect } from "react";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import {
  PULSE_ORIGIN,
  PULSE_PENDING_AUTH,
  PULSE_WEBSITE_ID,
  pulseAllowed,
  pulseDomains,
  pulseIdentify,
  pulseTrack,
} from "@/lib/pulse";

export function PulseRoot() {
  const shareAnalytics = useSettings((s) => s.shareAnalytics);
  const authed = useSession((s) => s.authed);
  const user = useSession((s) => s.user);
  const optedOut =
    !shareAnalytics ||
    (typeof navigator !== "undefined" && navigator.doNotTrack === "1");

  useEffect(() => {
    if (!pulseAllowed()) return;
    if (authed !== true || !user?.id) return;
    pulseIdentify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    try {
      const pending = sessionStorage.getItem(PULSE_PENDING_AUTH);
      if (pending === "signup" || pending === "login") {
        pulseTrack(pending, { platform: "web" });
        sessionStorage.removeItem(PULSE_PENDING_AUTH);
      }
    } catch {
      /* private mode */
    }
  }, [authed, user?.id, user?.email, user?.name, user?.role]);

  if (optedOut || !PULSE_WEBSITE_ID) return null;

  return (
    <Pulse
      websiteId={PULSE_WEBSITE_ID}
      origin={PULSE_ORIGIN}
      domains={pulseDomains()}
    />
  );
}
