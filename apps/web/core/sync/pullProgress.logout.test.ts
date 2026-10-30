import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The initial pull (ProgressSync on load, /welcome) is a GET. If the user logs out
// while it is in flight, its reply is the old user's: it must not re-hydrate the
// stores, write the old user's journal and games to Dexie, or sign the old user in.

vi.mock("@/core/pwa/clearRuntimeCaches", () => ({
  clearRuntimeCaches: async () => undefined,
}));
const dexie = vi.hoisted(() => ({
  replaceJournalEntries: vi.fn(async () => undefined),
  replaceGamesFromSync: vi.fn(async () => undefined),
}));
vi.mock("@/core/db/db", () => ({
  listJournal: async () => [],
  listGames: async () => [],
  replaceJournalEntries: dexie.replaceJournalEntries,
  replaceGamesFromSync: dexie.replaceGamesFromSync,
  reconcileLocalRows: async () => undefined,
}));

import { pullProgress } from "@/core/sync/pullProgress";
import { usePlan } from "@/core/store/plan.store";
import { progressGeneration, useProgression } from "@/core/store/progression.store";
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
      homeworkStreak: 3,
      homeworkLastDay: "2026-10-29",
      journalEntries: [{ id: "j1" }],
      recentGames: [{ id: "g1" }],
      placementDone: true,
    }),
    { status: 200 },
  );

function logout() {
  // what LogoutButton does
  useProgression.getState().reset();
  usePlan.setState({
    routineDay: null,
    routineDone: [],
    homeworkStreak: 0,
    homeworkLastDay: null,
  });
  useSession.getState().setSession(false, null);
}

beforeEach(() => {
  useProgression.getState().reset();
  usePlan.setState({ homeworkStreak: 0, homeworkLastDay: null });
  useSession.getState().setSession(false, null);
  dexie.replaceJournalEntries.mockClear();
  dexie.replaceGamesFromSync.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("pullProgress vs logout", () => {
  it("hydrates the stores, Dexie and the session when nothing happened (control)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => replyA()),
    );
    const user = await pullProgress();
    expect(user?.id).toBe("A");
    expect(useProgression.getState().xp).toBe(900);
    expect(useSession.getState().authed).toBe(true);
    expect(dexie.replaceJournalEntries).toHaveBeenCalled();
    expect(dexie.replaceGamesFromSync).toHaveBeenCalled();
  });

  it("a reply that arrives after the logout wipe leaves the old user out of the stores, Dexie and the session", async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (resolve = r));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending),
    );
    useSession.getState().setSession(true, userA);

    const pull = pullProgress();
    logout(); // while the GET is in flight
    resolve(replyA());
    const user = await pull;

    expect(user).toBeNull();
    expect(useProgression.getState().xp).toBe(0);
    expect(useProgression.getState().streak).toBe(0);
    expect(usePlan.getState().homeworkStreak).toBe(0);
    expect(useSession.getState().authed).toBe(false);
    expect(useSession.getState().user).toBeNull();
    expect(dexie.replaceJournalEntries).not.toHaveBeenCalled();
    expect(dexie.replaceGamesFromSync).not.toHaveBeenCalled();
  });

  // A session-expiry 401 is not a logout: web never resets the store on it, so the
  // last edit stays (as guest progress) and the generation does not move.
  it("a 401 signs the session out but keeps the local progress and does not start a new generation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    useSession.getState().setSession(true, userA);
    useProgression.setState({ xp: 640 });
    const before = progressGeneration();

    const user = await pullProgress();

    expect(user).toBeNull();
    expect(useSession.getState().authed).toBe(false);
    expect(useProgression.getState().xp).toBe(640); // the edit stays as guest progress
    expect(progressGeneration()).toBe(before);
  });
});
