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
  reconcileLocalRows: async () => undefined,
}));

import { clearSignedInMarker, getSignedInMarker } from "@/core/sync/guestOwner";
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

  it("a 401 for a signed-in session whose user is not known keeps the copy with a tag that matches nobody", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    useSession.getState().setSession(true, null);
    useProgression.setState({ xp: 640 });
    await pullProgress();
    expect(localStorage.getItem("chessschool.guestOwner")).toBe("?");
  });

  it("fails closed: with the owner unknown, the next sign-in gets none of it (same user or another)", async () => {
    for (const user of [userB, userA]) {
      localStorage.clear();
      useProgression.getState().reset();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("{}", { status: 401 })),
      );
      useSession.getState().setSession(true, null);
      useProgression.setState({ xp: 640 });
      await pullProgress();
      await nextPull(user, 0);
      expect(useProgression.getState().xp).toBe(0);
    }
  });

  it("a 401 for a visitor who was never signed in leaves the copy untagged (plain guest)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    useSession.getState().setSession(false, null);
    useProgression.setState({ xp: 40 });
    await pullProgress();
    expect(localStorage.getItem("chessschool.guestOwner")).toBeNull();
    await nextPull(userB, 0);
    expect(useProgression.getState().xp).toBe(40);
  });

  it("web keeps no last-user id: after an explicit logout a late 401 leaves no tag for the old user", async () => {
    useSession.getState().setSession(true, userA);
    useProgression.setState({ xp: 640 });
    // explicit logout: the session is gone (LogoutButton also clears the tag and wipes the stores)
    useSession.getState().setSession(false, null);
    useProgression.getState().reset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    await pullProgress();
    expect(localStorage.getItem("chessschool.guestOwner")).toBeNull();
    const user = await nextPull(userB, 0);
    expect(user?.id).toBe("B");
    expect(useProgression.getState().xp).toBe(0);
  });

  describe("cold start: the signed-in marker tells a kept copy from a real guest's", () => {
    /** The app starts again: the persisted session is gone, the persisted store still holds the progress. */
    function coldStart(xp: number) {
      useSession.setState({ authed: null, user: null, isAdmin: false });
      useProgression.setState({ xp });
    }
    const pull401 = () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("{}", { status: 401 })),
      );
      return pullProgress();
    };

    it("a successful pull writes the marker with the user id; a failed pull does not", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("{}", { status: 500 })),
      );
      await pullProgress();
      expect(getSignedInMarker()).toBeNull();
      await nextPull(userA, 640);
      expect(getSignedInMarker()).toBe("A");
    });

    it("A pulls, the app restarts, a 401 tags the copy A, then B signs in and gets none of A's progress", async () => {
      await nextPull(userA, 640);
      coldStart(640);
      await pull401();
      expect(localStorage.getItem("chessschool.guestOwner")).toBe("A");
      expect(getSignedInMarker()).toBeNull(); // consumed: the tag now says whose it is
      const user = await nextPull(userB, 0);
      expect(user?.id).toBe("B");
      expect(useProgression.getState().xp).toBe(0);
    });

    it("A pulls, the app restarts, a 401 and A signs back in: A keeps the copy (empty account merges it)", async () => {
      await nextPull(userA, 640);
      coldStart(640);
      await pull401();
      await nextPull(userA, 0);
      expect(useProgression.getState().xp).toBe(640);
    });

    it("the persisted session says signed out, A's data in the store, marker set: same, nothing for B", async () => {
      await nextPull(userA, 640);
      useSession.setState({ authed: false, user: null, isAdmin: false });
      useProgression.setState({ xp: 640 });
      await pull401();
      expect(localStorage.getItem("chessschool.guestOwner")).toBe("A");
      await nextPull(userB, 0);
      expect(useProgression.getState().xp).toBe(0);
    });

    it("a marker without an owner tags the copy with a value that matches nobody: A and B both get none", async () => {
      localStorage.setItem("chessschool.signedIn", "?");
      for (const who of [userA, userB]) {
        useSession.setState({ authed: null, user: null, isAdmin: false });
        useProgression.setState({ xp: 640 });
        localStorage.removeItem("chessschool.guestOwner");
        localStorage.setItem("chessschool.signedIn", "?");
        await pull401();
        expect(localStorage.getItem("chessschool.guestOwner")).toBe("?");
        await nextPull(who, 0);
        expect(useProgression.getState().xp).toBe(0);
      }
    });

    it("no marker: a real guest (session unknown) is left untagged and the copy merges into whoever signs in", async () => {
      coldStart(40);
      await pull401();
      expect(localStorage.getItem("chessschool.guestOwner")).toBeNull();
      await nextPull(userB, 0);
      expect(useProgression.getState().xp).toBe(40);
    });

    it("an explicit logout clears the marker, so a later 401 leaves the guest copy untagged", async () => {
      await nextPull(userA, 640);
      clearSignedInMarker(); // what LogoutButton and DeleteAccountButton do
      useProgression.getState().reset();
      coldStart(40); // a guest edit after the logout
      await pull401();
      expect(localStorage.getItem("chessschool.guestOwner")).toBeNull();
      await nextPull(userB, 0);
      expect(useProgression.getState().xp).toBe(40);
    });
  });
});

describe("(i) a pull for a user other than the signed-in marker's drops the store left on the device", () => {
  it("A pulls, nothing signs A out (no logout, no 401), B pulls: none of A's leftover progress is visible to B", async () => {
    await nextPull(userA, 640);
    expect(getSignedInMarker()).toBe("A");
    // A's work since the pull sits in the persisted stores
    useProgression.setState({ xp: 900 });
    usePlan.setState({
      routineDay: "2026-11-01",
      routineDone: ["a-lesson"],
      homeworkStreak: 4,
    });
    const user = await nextPull(userB, 0); // B's account is new: it must not absorb A's store
    expect(user?.id).toBe("B");
    expect(useProgression.getState().xp).toBe(0);
    expect(usePlan.getState().routineDone).toEqual([]);
    expect(usePlan.getState().routineDay).toBeNull();
    expect(getSignedInMarker()).toBe("B");
  });

  it("B with progress of their own: A's leftover adds nothing to it", async () => {
    await nextPull(userA, 640);
    useProgression.setState({ xp: 900 });
    usePlan.setState({ routineDone: ["a-lesson"] });
    await nextPull(userB, 120);
    expect(useProgression.getState().xp).toBe(120);
    expect(usePlan.getState().routineDone).toEqual([]);
  });

  it("a marker with no owner ('?') matches nobody: the store goes for any user", async () => {
    localStorage.setItem("chessschool.signedIn", "?");
    useProgression.setState({ xp: 640 });
    await nextPull(userA, 0);
    expect(useProgression.getState().xp).toBe(0);
  });

  it("A pulls again with A's own marker: the store is kept (no reset), an empty account still merges it", async () => {
    await nextPull(userA, 640);
    useProgression.setState({ xp: 900 });
    usePlan.setState({ routineDone: ["a-lesson"] });
    const user = await nextPull(userA, 0);
    expect(user?.id).toBe("A");
    expect(useProgression.getState().xp).toBe(900);
    expect(usePlan.getState().routineDone).toEqual(["a-lesson"]);
    expect(getSignedInMarker()).toBe("A");
  });

  it("no marker (a real guest): the guest's progress still merges into the account that signs in", async () => {
    useProgression.setState({ xp: 40 });
    await nextPull(userB, 0);
    expect(useProgression.getState().xp).toBe(40);
  });
});
