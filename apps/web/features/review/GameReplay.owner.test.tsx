import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

// Same in-memory Dexie stand-in as db.owner.test.ts. The owner logic under test is
// db.ts + the replay screen, not IndexedDB.
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
    constructor() {}
    version() {
      return { stores: () => undefined };
    }
    async transaction(_mode: string, ...args: unknown[]) {
      await (args[args.length - 1] as () => Promise<void>)();
    }
  }
  return { default: Dexie };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/board/ChessBoard", () => ({
  ChessBoard: () => <div data-testid="board" />,
}));

import { clearLocalRows, db, replaceGamesFromSync, type SavedGame } from "@/core/db/db";
import { useSession } from "@/core/store/session.store";
import { GameReplay } from "./GameReplay";

const USER_A = "user-a";
const USER_B = "user-b";
const OWN_ID = "own-game";
const OTHER_ID = "other-game";

const userA = { id: USER_A, email: "a@x.test", name: "A", role: "student" };

function saved(id: string, owner: string): SavedGame {
  return {
    id,
    owner,
    mode: "bot",
    pgn: "1. e4 e5 2. Nf3 Nc6",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    whiteName: "You",
    blackName: "Bot",
    createdAt: 1,
    updatedAt: 2,
    turn: "w",
    result: "*",
    endReason: "draw",
    winner: null,
    moveCount: 4,
    elo: 800,
    durationMs: 1000,
  };
}

/** Standing on /review, then a client transition to /review/<id>. */
function ReviewClientNav({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Open game
      </button>
    );
  }
  return <GameReplay id={id} />;
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(async () => {
  localStorage.clear();
  useSession.setState({ authed: null, user: null, isAdmin: false });
  await clearLocalRows();
});

afterEach(() => {
  cleanup();
});

async function seedOwnAndOther() {
  await db.games.put(saved(OWN_ID, USER_A));
  await db.games.put(saved(OTHER_ID, USER_B));
}

describe("/review/<gameId> owner scope", () => {
  it("hard load renders the signed-in user's own game after the owner scope settles", async () => {
    await seedOwnAndOther();
    render(<GameReplay id={OWN_ID} />);
    await settle();
    // The pull writes games before it publishes the user id. An empty snapshot
    // must not delete this user's row.
    await replaceGamesFromSync([], USER_A);
    expect(screen.queryByText("Game not found.")).toBeNull();

    await act(async () => {
      useSession.getState().setSession(true, userA);
    });

    expect(await screen.findByRole("link", { name: /All games/ })).toBeTruthy();
    expect(screen.getByText(/e4/)).toBeTruthy();
    expect(screen.queryByText("Game not found.")).toBeNull();
  });

  it("client nav from /review renders the signed-in user's own game", async () => {
    await seedOwnAndOther();
    render(<ReviewClientNav id={OWN_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Open game" }));
    await settle();
    await replaceGamesFromSync([], USER_A);
    expect(screen.queryByText("Game not found.")).toBeNull();

    await act(async () => {
      useSession.getState().setSession(true, userA);
    });

    expect(await screen.findByRole("link", { name: /All games/ })).toBeTruthy();
    expect(screen.getByText(/e4/)).toBeTruthy();
    expect(screen.queryByText("Game not found.")).toBeNull();
  });

  it("another user's game id stays not found once we know who is signed in", async () => {
    await seedOwnAndOther();
    render(<GameReplay id={OTHER_ID} />);
    await settle();
    expect(screen.queryByText("Game not found.")).toBeNull();
    expect(screen.queryByRole("link", { name: /All games/ })).toBeNull();

    await act(async () => {
      useSession.getState().setSession(true, userA);
    });

    expect(await screen.findByText("Game not found.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /All games/ })).toBeNull();
    expect(screen.queryByText(/e4/)).toBeNull();
  });
});
