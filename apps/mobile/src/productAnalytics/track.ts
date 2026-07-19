import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/api";
import { settings } from "@/settings";

/** Keep in sync with apps/web/core/analytics/track.ts + api-schemas. */
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

const SESSION_KEY = "chessschool.analytics.session";
const queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let sessionId: string | null = null;
const isWeb = Platform.OS === "web";

async function analyticsSessionId(): Promise<string> {
  if (sessionId) return sessionId;
  try {
    if (isWeb && typeof localStorage !== "undefined") {
      const existing = localStorage.getItem(SESSION_KEY);
      if (existing) {
        sessionId = existing;
        return existing;
      }
      sessionId = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, sessionId);
      return sessionId;
    }
    const existing = await SecureStore.getItemAsync(SESSION_KEY);
    if (existing) {
      sessionId = existing;
      return existing;
    }
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(SESSION_KEY, sessionId);
    return sessionId;
  } catch {
    sessionId = "anon";
    return sessionId;
  }
}

async function flush(): Promise<void> {
  timer = undefined;
  if (queue.length === 0) return;
  if (!settings.get().shareAnalytics) {
    queue.length = 0;
    return;
  }

  const batch = queue.splice(0, queue.length);
  const sid = await analyticsSessionId();
  try {
    await api("/api/events", {
      method: "POST",
      body: {
        events: batch.map((e) => ({
          name: e.name,
          props: {
            ...e.props,
            platform: Platform.OS,
          },
          pathname: e.pathname,
          sessionId: sid,
        })),
      },
    });
  } catch {
    /* offline / rate limit — drop batch */
  }
}

/** Queue a product analytics event (debounced batch POST to /api/events). */
export function trackEvent(
  name: AnalyticsEventName,
  props?: Record<string, unknown>,
  pathname?: string,
): void {
  if (!settings.get().shareAnalytics) return;
  queue.push({ name, props, pathname });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void flush();
  }, 800);
}
