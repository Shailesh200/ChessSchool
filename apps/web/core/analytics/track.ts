"use client";

import { useSettings } from "@/core/store/settings.store";
import { pulseTrack } from "@/lib/pulse";

export type AnalyticsEventName =
  | "page_view"
  | "lesson_complete"
  | "lesson_start"
  | "placement_complete"
  | "game_end"
  | "match_start"
  | "match_end"
  | "feature_open"
  | "think_puzzle_result"
  | "search_open"
  | "signup"
  | "login"
  | "pwa_install"
  | "onboarding_complete"
  | "exam_complete"
  | "class_graduate"
  | "homework_complete"
  | "online_game_create"
  | "online_game_join"
  | "bot_game_start"
  | "account_delete"
  | "journal_reflection"
  | "search_result_open"
  | "enroll_cta_click"
  | "coach_character_select";

type Pending = {
  name: AnalyticsEventName;
  props?: Record<string, unknown>;
  pathname?: string;
};

const queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let sessionId: string | null = null;

function analyticsSessionId(): string {
  if (sessionId) return sessionId;
  try {
    const key = "chessschool.analytics.session";
    const existing = sessionStorage.getItem(key);
    if (existing) {
      sessionId = existing;
      return existing;
    }
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
    return sessionId;
  } catch {
    sessionId = "anon";
    return sessionId;
  }
}

function flush() {
  timer = undefined;
  if (queue.length === 0) return;
  if (navigator.doNotTrack === "1") {
    queue.length = 0;
    return;
  }
  if (!useSettings.getState().shareAnalytics) {
    queue.length = 0;
    return;
  }

  const batch = queue.splice(0, queue.length);
  const body = JSON.stringify({
    events: batch.map((e) => ({
      name: e.name,
      props: e.props,
      pathname:
        e.pathname ??
        (typeof window !== "undefined" ? window.location.pathname : undefined),
      sessionId: analyticsSessionId(),
    })),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => void 0);
  }
}

/** Queue a product analytics event (debounced batch POST). */
export function trackEvent(
  name: AnalyticsEventName,
  props?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  queue.push({ name, props });
  clearTimeout(timer);
  timer = setTimeout(flush, 800);
  pulseTrack(name, props);
}
