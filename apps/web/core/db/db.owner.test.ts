import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory stand-in for Dexie (the lockfile has no fake-indexeddb): just the calls
// db.ts makes. The owner logic under test is db.ts + rowOwner.ts, not Dexie itself.
vi.mock("dexie", () => {
  type Row = Record<string, unknown> & { id: string };
  class Table {
    rows = new Map<string, Row>();
    async put(r: Row) {
      this.rows.set(r.id, { ...r });
    }
    async bulkPut(rs: Row[]) {
      for (const r of rs) this.rows.set(r.id, { ...r });
    }
    async bulkAdd(rs: Row[]) {
      for (const r of rs) this.rows.set(r.id, { ...r });
    }
    async bulkDelete(ids: string[]) {
      for (const id of ids) this.rows.delete(id);
    }
    async get(id: string) {
      const r = this.rows.get(id);
      return r ? { ...r } : undefined;
    }
    async delete(id: string) {
      this.rows.delete(id);
    }
    async clear() {
      this.rows.clear();
    }
    async toArray() {
      return [...this.rows.values()].map((r) => ({ ...r }));
    }
    orderBy(key: string) {
      const sorted = () =>
        [...this.rows.values()]
          .sort((a, b) => String(a[key]).localeCompare(String(b[key])))
          .map((r) => ({ ...r }));
      return {
        reverse: () => ({ toArray: async () => sorted().reverse() }),
        toArray: async () => sorted(),
      };
    }
    where(key: string) {
      return {
        belowOrEqual: (n: number) => ({
          toArray: async () =>
            [...this.rows.values()]
              .filter((r) => (r[key] as number) <= n)
              .map((r) => ({ ...r })),
        }),
      };
    }
  }
  class Dexie {
    games = new Table();
    reviews = new Table();
    journal = new Table();
    constructor(_name: string) {}
    version() {
      return { stores: () => undefined };
    }
    async transaction(_mode: string, ...args: unknown[]) {
      await (args[args.length - 1] as () => Promise<void>)();
    }
  }
  return { default: Dexie };
});

import {
  addJournalEntry,
  clearLocalRows,
  db,
  dueReviews,
  getGame,
  listGames,
  listJournal,
  reconcileLocalRows,
  replaceGamesFromSync,
  replaceJournalEntries,
  saveGame,
  upsertReview,
  type JournalEntry,
  type SavedGame,
} from "@/core/db/db";
import { useSession } from "@/core/store/session.store";
import { markSignedIn, setGuestOwner } from "@/core/sync/guestOwner";

const user = (id: string) => ({ id, email: `${id}@x.test`, name: id, role: "student" });
const signInAs = (id: string) => useSession.getState().setSession(true, user(id));
const signOut = () => useSession.getState().setSession(false, null);

const game = (id: string, over: Partial<SavedGame> = {}): SavedGame =>
  ({
    id,
    mode: "bot",
    pgn: "1. e4",
    fen: "",
    result: "1-0",
    reason: "checkmate",
    createdAt: 1,
    updatedAt: Number(id.replace(/\D/g, "")) || 1,
    moveCount: 1,
    elo: null,
    durationMs: 1,
    ...over,
  }) as SavedGame;
const entry = (id: string, over: Partial<JournalEntry> = {}): JournalEntry =>
  ({
    id,
    day: "2026-10-29",
    date: id,
    kind: "lesson",
    title: "t",
    note: "n",
    summary: "",
    ref: null,
    ...over,
  }) as JournalEntry;

const owners = async (t: "games" | "journal" | "reviews") =>
  Object.fromEntries(
    (await db[t].toArray()).map((r) => [r.id, (r as { owner?: string }).owner]),
  );

beforeEach(async () => {
  localStorage.clear();
  signOut();
  await clearLocalRows();
});

describe("rows are owner-tagged when queued", () => {
  it("stamps the signed-in user on a saved game, a journal entry and a review", async () => {
    signInAs("A");
    await saveGame(game("g1"));
    await addJournalEntry(entry("j1"));
    await upsertReview({ id: "r1", kind: "x", dueAt: 0, tag: "t", ease: 2 } as never);
    expect(await owners("games")).toEqual({ g1: "A" });
    expect(await owners("journal")).toEqual({ j1: "A" });
    expect(await owners("reviews")).toEqual({ r1: "A" });
  });

  it("stamps a signed-out visitor's rows as guest", async () => {
    await saveGame(game("g1"));
    expect(await owners("games")).toEqual({ g1: "guest" });
  });

  it("stamps the kept copy's user after a session expiry, not guest", async () => {
    signInAs("A");
    signOut();
    setGuestOwner("A"); // what handleSessionExpired leaves
    await addJournalEntry(entry("j1"));
    expect(await owners("journal")).toEqual({ j1: "A" });
  });

  it('stamps nobody ("?") when signed in but the id is not known', async () => {
    useSession.setState({ authed: true, user: null } as never);
    await saveGame(game("g1"));
    expect(await owners("games")).toEqual({ g1: "?" });
  });
});

describe("reads and pushes see only the current user's rows (fail closed)", () => {
  beforeEach(async () => {
    signInAs("A");
    await saveGame(game("g1"));
    await addJournalEntry(entry("j1"));
    await upsertReview({ id: "r1", kind: "x", dueAt: 0, tag: "t", ease: 2 } as never);
  });

  it("A's rows are invisible to B", async () => {
    signInAs("B");
    expect(await listGames()).toEqual([]);
    expect(await listJournal()).toEqual([]);
    expect(await dueReviews()).toEqual([]);
    expect(await getGame("g1")).toBeUndefined();
  });

  it("a saved note is announced for the open list and stays hidden from the other user", async () => {
    signInAs("A");
    const notes: string[][] = [];
    const onChange = () => {
      void listJournal().then((rows) => notes.push(rows.map((r) => r.note)));
    };
    window.addEventListener("chessschool-journal", onChange);
    try {
      await addJournalEntry(entry("j-saved", { note: "reflect-note" }));
      await vi.waitFor(() => expect(notes.at(-1)).toContain("reflect-note"));
      signInAs("B");
      expect((await listJournal()).map((r) => r.note)).not.toContain("reflect-note");
    } finally {
      window.removeEventListener("chessschool-journal", onChange);
    }
  });

  it("A sees their own rows", async () => {
    expect(await listGames()).toHaveLength(1);
    expect(await listJournal()).toHaveLength(1);
    expect(await dueReviews()).toHaveLength(1);
    expect((await getGame("g1"))?.id).toBe("g1");
  });

  it("a signed-out visitor does not see A's rows", async () => {
    signOut();
    expect(await listGames()).toEqual([]);
    expect(await listJournal()).toEqual([]);
  });

  it("an untagged (pre-upgrade) row belongs to the device's last user only", async () => {
    await db.journal.put(entry("old") as never);
    markSignedIn("A");
    signInAs("A");
    expect((await listJournal()).map((e) => e.id).sort()).toEqual(["j1", "old"]);
    signInAs("B");
    expect(await listJournal()).toEqual([]);
  });
});

describe("clearLocalRows (logout / delete account)", () => {
  it("empties games, reviews and journal", async () => {
    signInAs("A");
    await saveGame(game("g1"));
    await addJournalEntry(entry("j1"));
    await upsertReview({ id: "r1", kind: "x", dueAt: 0, tag: "t", ease: 2 } as never);
    await clearLocalRows();
    expect(await db.games.toArray()).toEqual([]);
    expect(await db.journal.toArray()).toEqual([]);
    expect(await db.reviews.toArray()).toEqual([]);
  });
});

describe("reconcileLocalRows (a pull succeeded for userId)", () => {
  async function seed() {
    await db.games.bulkPut([
      game("g1", { owner: "A" }),
      game("g2", { owner: "B" }),
      game("g3", { owner: "guest" }),
      game("g4", { owner: "?" }),
      game("g5"), // untagged
    ] as never);
    await db.journal.bulkPut([
      entry("j1", { owner: "A" }),
      entry("j2", { owner: "B" }),
      entry("j3", { owner: "guest" }),
      entry("j4"),
    ] as never);
  }

  it("B signs in after A: A's, unknown and untagged-A rows are dropped; B's stay", async () => {
    await seed();
    await reconcileLocalRows("B", false, "A");
    expect(await owners("games")).toEqual({ g2: "B" });
    expect(await owners("journal")).toEqual({ j2: "B" });
  });

  it("a new account (adoptGuest) absorbs the guest's rows and tags them", async () => {
    await seed();
    await reconcileLocalRows("B", true, "A");
    expect(await owners("games")).toEqual({ g2: "B", g3: "B" });
    expect(await owners("journal")).toEqual({ j2: "B", j3: "B" });
  });

  it("an established account does not take the guest's rows", async () => {
    await seed();
    await reconcileLocalRows("B", false, "guest");
    // untagged rows were a guest's here: dropped too
    expect(await owners("games")).toEqual({ g2: "B" });
    expect(await owners("journal")).toEqual({ j2: "B" });
  });

  it("the same user keeps their rows, untagged ones are tagged for them", async () => {
    await seed();
    await reconcileLocalRows("A", false, "A");
    expect(await owners("games")).toEqual({ g1: "A", g5: "A" });
    expect(await owners("journal")).toEqual({ j1: "A", j4: "A" });
  });
});

describe("pull writes", () => {
  it("replaceJournalEntries / replaceGamesFromSync tag the rows with the account's user", async () => {
    await replaceJournalEntries([entry("j1")], "B");
    await replaceGamesFromSync(
      [
        {
          id: "s1",
          mode: "bot",
          pgn: "1. e4",
          result: "1-0",
          reason: "checkmate",
          at: 5,
        },
      ],
      "B",
    );
    expect(await owners("journal")).toEqual({ j1: "B" });
    for (const o of Object.values(await owners("games"))) expect(o).toBe("B");
  });
});
