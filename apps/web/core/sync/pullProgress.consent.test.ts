import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Account sync and the one-time privacy reset: an old account 'on' (saved before the reset) can
// not turn analytics back on; an opt-in made after the reset survives a sync and reaches other
// devices.

vi.mock("@/core/pwa/clearRuntimeCaches", () => ({
  clearRuntimeCaches: async () => undefined,
}));
vi.mock("@/core/db/db", () => ({
  listJournal: async () => [],
  listGames: async () => [],
  replaceJournalEntries: async () => undefined,
  replaceGamesFromSync: async () => undefined,
  reconcileLocalRows: async () => undefined,
}));

import { fullSnapshot, pullProgress } from "@/core/sync/pullProgress";
import { PRIVACY_SETTINGS_VERSION, useSettings } from "@/core/store/settings.store";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";

const user = { id: "A", email: "a@x.test", name: "A", role: "student" };
const account = (settings: Record<string, unknown>) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            user,
            xp: 5,
            streak: 0,
            rating: 800,
            lastActiveDay: null,
            dailyGoalXp: 50,
            graduatedClasses: [],
            lessons: {},
            placementDone: false,
            settings,
          }),
          { status: 200 },
        ),
    ),
  );

beforeEach(async () => {
  localStorage.clear();
  useProgression.getState().reset();
  usePlan.setState({ homeworkStreak: 0, homeworkLastDay: null });
  useSession.getState().setSession(false, null);
  useSettings.getState().reset();
});
afterEach(() => vi.unstubAllGlobals());

describe("account sync and the privacy reset", () => {
  it("an old account 'on' with no version becomes (stays) off", async () => {
    account({ shareAnalytics: true, haptics: false });
    await pullProgress();
    expect(useSettings.getState().shareAnalytics).toBe(false);
    expect(useSettings.getState().haptics).toBe(false); // other settings still sync
  });

  it("an old account 'on' with an older version becomes off", async () => {
    account({ shareAnalytics: true, settingsVersion: PRIVACY_SETTINGS_VERSION - 1 });
    await pullProgress();
    expect(useSettings.getState().shareAnalytics).toBe(false);
  });

  it("an opt-in made after the reset survives a sync from an old account copy", async () => {
    useSettings.getState().set("shareAnalytics", true);
    account({ shareAnalytics: false, haptics: true }); // old copy, no version
    await pullProgress();
    expect(useSettings.getState().shareAnalytics).toBe(true);
    account({ shareAnalytics: true }); // an old 'on' does not matter either way
    await pullProgress();
    expect(useSettings.getState().shareAnalytics).toBe(true);
  });

  it("an opt-in made on another device (current version) reaches this one", async () => {
    account({ shareAnalytics: true, settingsVersion: PRIVACY_SETTINGS_VERSION });
    await pullProgress();
    expect(useSettings.getState().shareAnalytics).toBe(true);
  });

  it("an opt-out made on another device reaches this one", async () => {
    useSettings.getState().set("shareAnalytics", true);
    account({ shareAnalytics: false, settingsVersion: PRIVACY_SETTINGS_VERSION });
    await pullProgress();
    expect(useSettings.getState().shareAnalytics).toBe(false);
  });

  it("a current-version account copy that never stored the flag is off", async () => {
    useSettings.getState().set("shareAnalytics", true);
    account({ settingsVersion: PRIVACY_SETTINGS_VERSION });
    await pullProgress();
    expect(useSettings.getState().shareAnalytics).toBe(false);
  });

  it("the push payload carries the settings version and the choice", () => {
    useSettings.getState().set("shareAnalytics", true);
    const s = fullSnapshot().settings as Record<string, unknown>;
    expect(s.settingsVersion).toBe(PRIVACY_SETTINGS_VERSION);
    expect(s.shareAnalytics).toBe(true);
  });
});
