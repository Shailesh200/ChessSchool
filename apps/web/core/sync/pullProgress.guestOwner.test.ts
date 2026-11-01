import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A session-expiry 401 signs the user out but keeps the edit as guest progress. The
// copy is tagged with the user who expired: only that user gets it back. A different
// user who signs in does not. A plain guest copy (never signed in) merges as before.

vi.mock("@/core/pwa/clearRuntimeCaches", () => ({
  clearRuntimeCaches: async () => undefined,
}));
vi.mock("@/core/db/db", () => ({
  listJournal: async () => [],
  listGames: async () => [],
  replaceJournalEntries: async () => undefined,
  replaceGamesFromSync: async () => undefined,
}));

import { pullProgress } from "@/core/sync/pullProgress";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";

const userA = { id: "A", email: "a@x.test", name: "A", role: "student" };
const userB = { id: "B", email: "b@x.test", name: "B", role: "student" };
const accountReply = (user: typeof userA, xp: number) =>
  new Response(
    JSON.stringify({
      user,
      xp,
      streak: 0,
      rating: 800,
      lastActiveDay: null,
      dailyGoalXp: 50,
      graduatedClasses: [],
      lessons: {},
      placementDone: false,
    }),
    { status: 200 },
  );

/** A is signed in with an edit; the next pull gets the 401. */
async function expireAsA() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 401 })),
  );
  useSession.getState().setSession(true, userA);
  useProgression.setState({ xp: 640 });
  await pullProgress();
  expect(useSession.getState().authed).toBe(false);
}
function nextPull(user: typeof userA, serverXp: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => accountReply(user, serverXp)),
  );
  return pullProgress();
}

beforeEach(() => {
  localStorage.clear();
  useProgression.getState().reset();
  usePlan.setState({ homeworkStreak: 0, homeworkLastDay: null });
  useSession.getState().setSession(false, null);
});
afterEach(() => vi.unstubAllGlobals());

describe("web guest copy kept after a 401 is tagged with its owner", () => {
  it("B signing in after A's 401 gets none of A's progress (new empty account)", async () => {
    await expireAsA();
    const user = await nextPull(userB, 0);
    expect(user?.id).toBe("B");
    expect(useProgression.getState().xp).toBe(0);
    expect(useSession.getState().user?.id).toBe("B");
  });

  it("B with an account that has progress gets their own, not a mix", async () => {
    await expireAsA();
    await nextPull(userB, 120);
    expect(useProgression.getState().xp).toBe(120);
  });

  it("A signing in again after the 401 gets their own progress back (empty account merges it)", async () => {
    await expireAsA();
    const user = await nextPull(userA, 0);
    expect(user?.id).toBe("A");
    expect(useProgression.getState().xp).toBe(640);
  });

  it("the tag is used once: after A's sign-in a later sign-in as B is a normal switch", async () => {
    await expireAsA();
    await nextPull(userA, 0);
    expect(localStorage.getItem("chessschool.guestOwner")).toBeNull();
  });

  it("an untagged guest (never signed in) still merges into the account that signs in", async () => {
    useProgression.setState({ xp: 40 });
    const user = await nextPull(userB, 0);
    expect(user?.id).toBe("B");
    expect(useProgression.getState().xp).toBe(40);
  });
});
