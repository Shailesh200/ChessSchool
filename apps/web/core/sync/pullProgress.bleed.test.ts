import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The bleed P0 on web: A's journal, games and reviews (Dexie) must not reach B's push.

vi.mock("@/core/pwa/clearRuntimeCaches", () => ({
  clearRuntimeCaches: async () => undefined,
}));
const dexie = vi.hoisted(() => ({
  order: [] as string[],
  journal: [] as unknown[],
  games: [] as unknown[],
  reconcileLocalRows: vi.fn(async (..._a: unknown[]) => undefined),
  replaceJournalEntries: vi.fn(async (..._a: unknown[]) => undefined),
  replaceGamesFromSync: vi.fn(async (..._a: unknown[]) => undefined),
}));
vi.mock("@/core/db/db", () => ({
  listJournal: async () => dexie.journal,
  listGames: async () => dexie.games,
  replaceJournalEntries: dexie.replaceJournalEntries,
  replaceGamesFromSync: dexie.replaceGamesFromSync,
  reconcileLocalRows: dexie.reconcileLocalRows,
}));

import {
  fullSnapshotAsync,
  handleSessionExpired,
  pullProgress,
} from "@/core/sync/pullProgress";
import {
  clearSignedInMarker,
  getGuestOwner,
  getSignedInMarker,
  markSignedIn,
} from "@/core/sync/guestOwner";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";

const userA = { id: "A", email: "a@x.test", name: "A", role: "student" };
const userB = { id: "B", email: "b@x.test", name: "B", role: "student" };
const reply = (user: typeof userA, extra: Record<string, unknown> = {}, xp = 0) =>
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
      ...extra,
    }),
    { status: 200 },
  );
const serve = (r: () => Response) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => r()),
  );

beforeEach(() => {
  localStorage.clear();
  useProgression.getState().reset();
  usePlan.setState({ homeworkStreak: 0, homeworkLastDay: null });
  useSession.getState().setSession(false, null);
  dexie.journal = [];
  dexie.games = [];
  dexie.reconcileLocalRows.mockClear();
  dexie.replaceJournalEntries.mockClear();
  dexie.replaceGamesFromSync.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("pull reconciles the local rows for the user who signed in", () => {
  it("B after A (A's marker): drops A's rows, untagged rows are read as A's", async () => {
    markSignedIn("A");
    serve(() => reply(userB, {}, 5)); // established account, has progress
    await pullProgress();
    expect(dexie.reconcileLocalRows).toHaveBeenCalledTimes(1);
    expect(dexie.reconcileLocalRows).toHaveBeenCalledWith("B", false, "A");
  });

  it("B after A's session expiry (kept-copy tag): legacy owner is read before the tag is cleared", async () => {
    useSession.getState().setSession(true, userA);
    handleSessionExpired();
    serve(() => reply(userB));
    await pullProgress();
    const [id, , legacy] = dexie.reconcileLocalRows.mock.calls[0]!;
    expect(id).toBe("B");
    expect(legacy).toBe("A");
    expect(getGuestOwner()).toBeNull(); // cleared after the read, as before
  });

  it("a new empty account adopts a guest's rows; an established one does not", async () => {
    serve(() => reply(userB)); // empty account
    await pullProgress();
    expect(dexie.reconcileLocalRows).toHaveBeenLastCalledWith("B", true, "guest");
    clearSignedInMarker();
    serve(() => reply(userB, { streak: 3, lastActiveDay: "2026-10-29" }, 10));
    await pullProgress();
    expect(dexie.reconcileLocalRows).toHaveBeenLastCalledWith("B", false, "guest");
  });

  it("reconciles before the pulled journal/games are written, and tags them with the account", async () => {
    const calls: string[] = [];
    dexie.reconcileLocalRows.mockImplementationOnce(
      async () => void calls.push("reconcile"),
    );
    dexie.replaceJournalEntries.mockImplementationOnce(
      async () => void calls.push("journal"),
    );
    dexie.replaceGamesFromSync.mockImplementationOnce(
      async () => void calls.push("games"),
    );
    serve(() => reply(userB, { journalEntries: [{ id: "j" }], recentGames: [] }));
    await pullProgress();
    expect(calls).toEqual(["reconcile", "journal", "games"]);
    expect(dexie.replaceJournalEntries).toHaveBeenCalledWith([{ id: "j" }], "B");
    expect(dexie.replaceGamesFromSync).toHaveBeenCalledWith([], "B");
  });

  it("a logout during the reconcile writes nothing of the old user's", async () => {
    dexie.reconcileLocalRows.mockImplementationOnce(async () => {
      useProgression.getState().reset(); // generation moves, like a logout
    });
    serve(() => reply(userA, { journalEntries: [{ id: "j" }], recentGames: [] }));
    const u = await pullProgress();
    expect(u).toBeNull();
    expect(dexie.replaceJournalEntries).not.toHaveBeenCalled();
    expect(dexie.replaceGamesFromSync).not.toHaveBeenCalled();
  });

  it("a failed reconcile does not break the sign-in (rows stay owner-filtered)", async () => {
    dexie.reconcileLocalRows.mockRejectedValueOnce(new Error("idb"));
    serve(() => reply(userB));
    expect((await pullProgress())?.id).toBe("B");
  });
});

describe("the push body never carries the owner tag", () => {
  it("strips owner from journal entries and games", async () => {
    dexie.journal = [{ id: "j1", owner: "B", note: "n" }];
    dexie.games = [
      {
        id: "g1",
        owner: "B",
        mode: "bot",
        pgn: "1. e4",
        result: "1-0",
        reason: "checkmate",
        updatedAt: 1,
        createdAt: 1,
      },
    ];
    const snap = await fullSnapshotAsync();
    expect(JSON.stringify(snap)).not.toContain('"owner"');
    expect((snap as { journalEntries: unknown[] }).journalEntries).toEqual([
      { id: "j1", note: "n" },
    ]);
  });
});

describe("handleSessionExpired (DP-W-002)", () => {
  it("signed in as A: tags the kept copy A, drops the marker, signs out", () => {
    useSession.getState().setSession(true, userA);
    markSignedIn("A");
    handleSessionExpired();
    expect(getGuestOwner()).toBe("A");
    expect(getSignedInMarker()).toBeNull();
    expect(useSession.getState().authed).toBe(false);
  });
  it("a real guest (no marker, signed out) is left alone", () => {
    handleSessionExpired();
    expect(getGuestOwner()).toBeNull();
  });
});
