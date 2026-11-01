import { describe, expect, it } from "vitest";
import {
  guardPrivacyVersion,
  mergeProgressPush,
  type ServerProgressState,
} from "./progress-merge";
import type { ProgressPushBody } from "@/lib/api-schemas";

// Server side of the one-time privacy reset. No schema change: settings is a free-form JSON record
// on the account, and settingsVersion is one more key in it.

const server = (settings?: Record<string, unknown>): ServerProgressState => ({
  xp: 0,
  streak: 0,
  lastActiveDay: null,
  dailyGoalXp: 50,
  graduatedClasses: [],
  lessons: {},
  extra: settings ? { settings } : {},
});
const push = (settings: Record<string, unknown>): ProgressPushBody => ({
  xp: 0,
  streak: 0,
  lastActiveDay: null,
  graduatedClasses: [],
  lessons: {},
  settings,
});
const merged = (s: ServerProgressState, settings: Record<string, unknown>) =>
  mergeProgressPush(push(settings), s).data.settings;

describe("the account keeps a newer privacy choice against a stale client", () => {
  it("an old client (no version, analytics on) can not turn it back on", () => {
    const out = merged(server({ shareAnalytics: false, settingsVersion: 1 }), {
      shareAnalytics: true,
      haptics: false,
    });
    expect(out).toMatchObject({
      shareAnalytics: false,
      settingsVersion: 1,
      haptics: false,
    });
  });

  it("an older version can not overwrite a newer one", () => {
    const out = merged(server({ shareAnalytics: false, settingsVersion: 2 }), {
      shareAnalytics: true,
      settingsVersion: 1,
    });
    expect(out).toMatchObject({ shareAnalytics: false, settingsVersion: 2 });
  });

  it("a current client's opt-in and opt-out both go through", () => {
    const on = merged(server({ shareAnalytics: false, settingsVersion: 1 }), {
      shareAnalytics: true,
      settingsVersion: 1,
    });
    expect(on).toMatchObject({ shareAnalytics: true, settingsVersion: 1 });
    const off = merged(server({ shareAnalytics: true, settingsVersion: 1 }), {
      shareAnalytics: false,
      settingsVersion: 1,
    });
    expect(off).toMatchObject({ shareAnalytics: false });
  });

  it("the first versioned push stamps an unversioned account", () => {
    const out = merged(server({ shareAnalytics: true }), {
      shareAnalytics: false,
      settingsVersion: 1,
    });
    expect(out).toMatchObject({ shareAnalytics: false, settingsVersion: 1 });
  });

  it("two unversioned sides merge as before (nothing to guard)", () => {
    expect(guardPrivacyVersion({ sound: true }, { shareAnalytics: true })).toEqual({
      shareAnalytics: true,
    });
  });
});
