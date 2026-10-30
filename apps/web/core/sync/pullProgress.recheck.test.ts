import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A logout (store reset) during the Dexie writes that follow the GET must not let the
// old user's games be written or the old user be signed in afterwards.

vi.mock("@/core/pwa/clearRuntimeCaches", () => ({
  clearRuntimeCaches: async () => undefined,
}));
const dexie = vi.hoisted(() => ({
  replaceJournalEntries: vi.fn<(entries: unknown[]) => Promise<void>>(
    async () => undefined,
  ),
  replaceGamesFromSync: vi.fn<(games: unknown[]) => Promise<void>>(
    async () => undefined,
  ),
}));
vi.mock("@/core/db/db", () => ({
  listJournal: async () => [],
  listGames: async () => [],
  replaceJournalEntries: dexie.replaceJournalEntries,
  replaceGamesFromSync: dexie.replaceGamesFromSync,
  reconcileLocalRows: async () => undefined,
}));

import { pullProgress } from "@/core/sync/pullProgress";
import { clearSignedInMarker, getSignedInMarker } from "@/core/sync/guestOwner";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";

const userA = { id: "A", email: "a@x.test", name: "A", role: "student" };
const replyA = () =>
  new Response(
    JSON.stringify({
      user: userA,
      xp: 900,
      streak: 6,
      rating: 1500,
      lastActiveDay: "2026-10-29",
      dailyGoalXp: 50,
      graduatedClasses: [],
      lessons: {},
      journalEntries: [{ id: "j1" }],
      recentGames: [{ id: "g1" }],
      placementDone: true,
    }),
    { status: 200 },
  );

function logout() {
  useProgression.getState().reset();
  usePlan.setState({
    routineDay: null,
    routineDone: [],
    homeworkStreak: 0,
    homeworkLastDay: null,
  });
  useSession.getState().setSession(false, null);
}
function gate() {
  let open!: () => void;
  const promise = new Promise<void>((r) => (open = r));
  return { promise, open };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function until(cond: () => boolean) {
  for (let i = 0; i < 200 && !cond(); i++) await tick();
}

beforeEach(() => {
  useProgression.getState().reset();
  useSession.getState().setSession(false, null);
  localStorage.clear();
  dexie.replaceJournalEntries.mockReset();
  dexie.replaceJournalEntries.mockImplementation(async () => undefined);
  dexie.replaceGamesFromSync.mockReset();
  dexie.replaceGamesFromSync.mockImplementation(async () => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => replyA()),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("pullProgress vs logout during the Dexie writes", () => {
  it("signs the user in and writes the games when nothing happened (control)", async () => {
    useSession.getState().setSession(true, userA);
    const user = await pullProgress();
    expect(user?.id).toBe("A");
    expect(dexie.replaceGamesFromSync).toHaveBeenCalledTimes(1);
    expect(useSession.getState().authed).toBe(true);
  });

  it("a logout during the journal write: no games write, no session for the old user", async () => {
    const g = gate();
    dexie.replaceJournalEntries.mockImplementation(() => g.promise);
    useSession.getState().setSession(true, userA);
    const pull = pullProgress();
    await until(() => dexie.replaceJournalEntries.mock.calls.length === 1);

    logout();
    g.open();
    const user = await pull;

    expect(user).toBeNull();
    expect(dexie.replaceGamesFromSync).not.toHaveBeenCalled();
    expect(useSession.getState().authed).toBe(false);
    expect(useSession.getState().user).toBeNull();
  });

  it("a logout during the games write: the old user is not signed in afterwards", async () => {
    const g = gate();
    dexie.replaceGamesFromSync.mockImplementation(() => g.promise);
    useSession.getState().setSession(true, userA);
    const pull = pullProgress();
    await until(() => dexie.replaceGamesFromSync.mock.calls.length === 1);

    logout();
    g.open();
    const user = await pull;

    expect(user).toBeNull();
    expect(useSession.getState().authed).toBe(false);
    expect(useSession.getState().user).toBeNull();
    expect(useProgression.getState().xp).toBe(0);
  });

  it("a logout during the games write leaves no signed-in marker (the marker is written last)", async () => {
    const g = gate();
    dexie.replaceGamesFromSync.mockImplementation(() => g.promise);
    useSession.getState().setSession(true, userA);
    const pull = pullProgress();
    await until(() => dexie.replaceGamesFromSync.mock.calls.length === 1);

    logout();
    clearSignedInMarker(); // what the logout button does
    g.open();

    expect(await pull).toBeNull();
    expect(getSignedInMarker()).toBeNull();
  });

  it("a logout during the journal write leaves no signed-in marker", async () => {
    const g = gate();
    dexie.replaceJournalEntries.mockImplementation(() => g.promise);
    useSession.getState().setSession(true, userA);
    const pull = pullProgress();
    await until(() => dexie.replaceJournalEntries.mock.calls.length === 1);

    logout();
    clearSignedInMarker();
    g.open();

    expect(await pull).toBeNull();
    expect(getSignedInMarker()).toBeNull();
  });
});
