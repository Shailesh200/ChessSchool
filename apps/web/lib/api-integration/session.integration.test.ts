import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { Chess } from "chess.js";
import { gameSessions } from "@/db/schema";
import {
  bootApiTestEnv,
  bearer,
  readJson,
  testIp,
  type TestDb,
} from "@/lib/test-db.harness";

const PW = "testpass123";

async function register(
  postRegister: typeof import("@/app/api/auth/register/route").POST,
  email: string,
  slot: number,
): Promise<string> {
  const res = await postRegister(
    new Request("http://test/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", ...testIp(slot) },
      body: JSON.stringify({ email, password: PW, name: email.split("@")[0] }),
    }),
  );
  expect(res.status).toBe(200);
  const { token } = await readJson<{ token: string }>(res);
  return token;
}

describe("session API integration", () => {
  let teardown: () => void = () => {};
  let db: TestDb;
  let postRegister: typeof import("@/app/api/auth/register/route").POST;
  let postSession: typeof import("@/app/api/session/route").POST;
  let getSession: typeof import("@/app/api/session/[id]/route").GET;
  let postSessionMove: typeof import("@/app/api/session/[id]/route").POST;
  let writeBarrier: typeof import("@/lib/session-write-barrier").sessionWriteBarrier = {
    wait: null,
  };

  beforeEach(async () => {
    vi.resetModules();
    ({ teardown, db } = await bootApiTestEnv());
    postRegister = (await import("@/app/api/auth/register/route")).POST;
    postSession = (await import("@/app/api/session/route")).POST;
    // Same module instance the route closes over (resetModules drops the last one).
    writeBarrier = (await import("@/lib/session-write-barrier")).sessionWriteBarrier;
    const sessionIdMod = await import("@/app/api/session/[id]/route");
    getSession = sessionIdMod.GET;
    postSessionMove = sessionIdMod.POST;
  });

  afterEach(() => {
    writeBarrier.wait = null;
    teardown();
    vi.resetModules();
  });

  it("rejects unauthenticated session create", async () => {
    const res = await postSession(
      new Request("http://test/api/session", {
        method: "POST",
        headers: testIp(60),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("seat tokens are user-bound — cannot move opponent seat", async () => {
    const stamp = Date.now();
    const whiteToken = await register(postRegister, `pvp-white-${stamp}@test.dev`, 61);
    const blackToken = await register(postRegister, `pvp-black-${stamp}@test.dev`, 62);

    const create = await postSession(
      new Request("http://test/api/session", {
        method: "POST",
        headers: { ...bearer(whiteToken), ...testIp(63) },
      }),
    );
    expect(create.status).toBe(200);
    const { id, seatToken: whiteSeat } = await readJson<{
      id: string;
      seatToken: string;
    }>(create);

    const join = await getSession(
      new Request(`http://test/api/session/${id}?join=1`, {
        headers: bearer(blackToken),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(join.status).toBe(200);
    const joined = await readJson<{ claimed: boolean; seatToken: string }>(join);
    expect(joined.claimed).toBe(true);

    const hijack = await postSessionMove(
      new Request(`http://test/api/session/${id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(blackToken),
          ...testIp(64),
        },
        body: JSON.stringify({
          action: "move",
          color: "w",
          seatToken: whiteSeat,
          from: "e2",
          to: "e4",
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(hijack.status).toBe(403);

    const whiteOpen = await postSessionMove(
      new Request(`http://test/api/session/${id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(whiteToken),
          ...testIp(65),
        },
        body: JSON.stringify({
          action: "move",
          color: "w",
          seatToken: whiteSeat,
          from: "e2",
          to: "e4",
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(whiteOpen.status).toBe(200);

    const legal = await postSessionMove(
      new Request(`http://test/api/session/${id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(blackToken),
          ...testIp(66),
        },
        body: JSON.stringify({
          action: "move",
          color: "b",
          seatToken: joined.seatToken,
          from: "e7",
          to: "e5",
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(legal.status).toBe(200);
    const after = await readJson<{ turn: string }>(legal);
    expect(after.turn).toBe("w");
  });

  it("rejects forged timeout when server clocks still have time", async () => {
    const stamp = Date.now();
    const whiteToken = await register(
      postRegister,
      `timeout-white-${stamp}@test.dev`,
      71,
    );
    const blackToken = await register(
      postRegister,
      `timeout-black-${stamp}@test.dev`,
      72,
    );

    const create = await postSession(
      new Request("http://test/api/session", {
        method: "POST",
        headers: { ...bearer(whiteToken), ...testIp(73) },
      }),
    );
    const { id, seatToken: whiteSeat } = await readJson<{
      id: string;
      seatToken: string;
    }>(create);

    const join = await getSession(
      new Request(`http://test/api/session/${id}?join=1`, {
        headers: bearer(blackToken),
      }),
      { params: Promise.resolve({ id }) },
    );
    const joined = await readJson<{ seatToken: string }>(join);

    const now = Date.now();
    await db
      .update(gameSessions)
      .set({
        status: "active",
        timeControlMin: 5,
        whiteMs: 300_000,
        blackMs: 300_000,
        turn: "w",
        updatedAt: now,
      })
      .where(eq(gameSessions.id, id));

    const forged = await postSessionMove(
      new Request(`http://test/api/session/${id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(blackToken),
          ...testIp(74),
        },
        body: JSON.stringify({
          action: "timeout",
          color: "w",
          seatToken: joined.seatToken,
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(forged.status).toBe(409);

    await db
      .update(gameSessions)
      .set({
        whiteMs: 0,
        blackMs: 300_000,
        turn: "w",
        updatedAt: now,
      })
      .where(eq(gameSessions.id, id));

    const legit = await postSessionMove(
      new Request(`http://test/api/session/${id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(blackToken),
          ...testIp(75),
        },
        body: JSON.stringify({
          action: "timeout",
          color: "w",
          seatToken: joined.seatToken,
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(legit.status).toBe(200);
    const over = await readJson<{ status: string; result: string }>(legit);
    expect(over.status).toBe("over");
    expect(over.result).toBe("time:b");
  });

  type Player = { token: string; seatToken: string };
  type SessionSnap = {
    status: string;
    result: string | null;
    fen: string;
    pgn: string;
    turn: string;
    lastFrom: string | null;
    lastTo: string | null;
    updatedAt: number;
    blackJoined: number;
  };
  type ConflictBody = SessionSnap & { error: string };

  let ipSlot = 90;
  function nextIp(): number {
    ipSlot += 1;
    return ipSlot;
  }

  async function openGame(label: string, opts?: { join?: boolean }) {
    const join = opts?.join !== false;
    const stamp = `${label}-${Date.now()}-${nextIp()}`;
    const whiteToken = await register(postRegister, `w-${stamp}@test.dev`, nextIp());
    const blackToken = await register(postRegister, `b-${stamp}@test.dev`, nextIp());
    const create = await postSession(
      new Request("http://test/api/session", {
        method: "POST",
        headers: { ...bearer(whiteToken), ...testIp(nextIp()) },
      }),
    );
    expect(create.status).toBe(200);
    const created = await readJson<{ id: string; seatToken: string }>(create);

    let blackSeat = "";
    if (join) {
      const joinedRes = await getSession(
        new Request(`http://test/api/session/${created.id}?join=1`, {
          headers: bearer(blackToken),
        }),
        { params: Promise.resolve({ id: created.id }) },
      );
      expect(joinedRes.status).toBe(200);
      const joined = await readJson<{
        claimed: boolean;
        seatToken: string;
        status: string;
      }>(joinedRes);
      expect(joined.claimed).toBe(true);
      expect(joined.status).toBe("active");
      blackSeat = joined.seatToken;
    }

    return {
      id: created.id,
      white: { token: whiteToken, seatToken: created.seatToken } satisfies Player,
      black: { token: blackToken, seatToken: blackSeat } satisfies Player,
    };
  }

  async function act(
    id: string,
    who: Player,
    body:
      | { action: "resign" }
      | { action: "timeout" }
      | { action: "move"; from: string; to: string },
  ) {
    return postSessionMove(
      new Request(`http://test/api/session/${id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(who.token),
          ...testIp(nextIp()),
        },
        body: JSON.stringify({ ...body, seatToken: who.seatToken }),
      }),
      { params: Promise.resolve({ id }) },
    );
  }

  async function readRow(id: string): Promise<SessionSnap & { id: string }> {
    const found = (
      await db.select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1)
    )[0];
    expect(found).toBeTruthy();
    return found!;
  }

  async function expectUnchanged(res: Response, id: string, before: SessionSnap) {
    expect(res.status).toBe(409);
    const body = await readJson<ConflictBody>(res);
    expect(body.error).toBe("game not active");
    expect(body.status).toBe(before.status);
    expect(body.result).toBe(before.result);
    expect(body.fen).toBe(before.fen);
    const after = await readRow(id);
    expect(after.status).toBe(before.status);
    expect(after.result).toBe(before.result);
    expect(after.fen).toBe(before.fen);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.blackJoined).toBe(before.blackJoined);
    return body;
  }

  it("rejects a move after resign and keeps the result", async () => {
    const game = await openGame("move-after-resign");
    const resigned = await act(game.id, game.white, { action: "resign" });
    expect(resigned.status).toBe(200);
    const done = await readJson<{ status: string; result: string }>(resigned);
    expect(done.status).toBe("over");
    expect(done.result).toBe("resign:w");

    const before = await readRow(game.id);
    await expectUnchanged(
      await act(game.id, game.white, { action: "move", from: "e2", to: "e4" }),
      game.id,
      before,
    );
    await expectUnchanged(
      await act(game.id, game.black, { action: "move", from: "e7", to: "e5" }),
      game.id,
      before,
    );

    // Black to move, then Black resigns — Black's reply must not reopen the game.
    const live = await openGame("move-after-resign-black");
    const opening = await act(live.id, live.white, {
      action: "move",
      from: "e2",
      to: "e4",
    });
    expect(opening.status).toBe(200);
    const blackResign = await act(live.id, live.black, { action: "resign" });
    expect(blackResign.status).toBe(200);
    const blackDone = await readJson<{ result: string }>(blackResign);
    expect(blackDone.result).toBe("resign:b");
    const afterResign = await readRow(live.id);
    await expectUnchanged(
      await act(live.id, live.black, { action: "move", from: "e7", to: "e5" }),
      live.id,
      afterResign,
    );
    await expectUnchanged(
      await act(live.id, live.white, { action: "move", from: "d2", to: "d4" }),
      live.id,
      afterResign,
    );
  });

  it("rejects a move after flag timeout and keeps the result", async () => {
    const game = await openGame("move-after-timeout");
    const now = Date.now();
    await db
      .update(gameSessions)
      .set({ whiteMs: 0, blackMs: 300_000, turn: "w", updatedAt: now })
      .where(eq(gameSessions.id, game.id));

    const flagged = await act(game.id, game.black, { action: "timeout" });
    expect(flagged.status).toBe(200);
    const over = await readJson<{ status: string; result: string }>(flagged);
    expect(over.status).toBe("over");
    expect(over.result).toBe("time:b");

    const before = await readRow(game.id);
    await expectUnchanged(
      await act(game.id, game.white, { action: "move", from: "e2", to: "e4" }),
      game.id,
      before,
    );
    await expectUnchanged(
      await act(game.id, game.black, { action: "move", from: "e7", to: "e5" }),
      game.id,
      before,
    );
  });

  it("rejects a second resign and does not flip the winner", async () => {
    const game = await openGame("resign-after-resign");
    const first = await act(game.id, game.white, { action: "resign" });
    expect(first.status).toBe(200);
    const won = await readJson<{ result: string }>(first);
    expect(won.result).toBe("resign:w");

    const before = await readRow(game.id);
    await expectUnchanged(
      await act(game.id, game.black, { action: "resign" }),
      game.id,
      before,
    );
    await expectUnchanged(
      await act(game.id, game.white, { action: "resign" }),
      game.id,
      before,
    );
  });

  it("rejects resign after checkmate and keeps the mate result", async () => {
    const game = await openGame("resign-after-mate");
    const moves: Array<[Player, string, string]> = [
      [game.white, "f2", "f3"],
      [game.black, "e7", "e5"],
      [game.white, "g2", "g4"],
      [game.black, "d8", "h4"],
    ];
    let last: { status: string; result: string | null } | undefined;
    for (const [who, from, to] of moves) {
      const res = await act(game.id, who, { action: "move", from, to });
      expect(res.status).toBe(200);
      last = await readJson<{ status: string; result: string | null }>(res);
    }
    expect(last?.status).toBe("over");
    expect(last?.result).toBe("0-1");

    const before = await readRow(game.id);
    await expectUnchanged(
      await act(game.id, game.white, { action: "resign" }),
      game.id,
      before,
    );
    await expectUnchanged(
      await act(game.id, game.black, { action: "resign" }),
      game.id,
      before,
    );
  });

  it("rejects a move while the game is waiting", async () => {
    const game = await openGame("move-while-waiting", { join: false });
    const before = await readRow(game.id);
    expect(before.status).toBe("waiting");
    expect(before.blackJoined).toBe(0);
    expect(before.result).toBeNull();

    const body = await expectUnchanged(
      await act(game.id, game.white, { action: "move", from: "e2", to: "e4" }),
      game.id,
      before,
    );
    expect(body.blackJoined).toBe(0);
  });

  it("rejects timeout on a finished game", async () => {
    const game = await openGame("timeout-after-over");
    const resigned = await act(game.id, game.white, { action: "resign" });
    expect(resigned.status).toBe(200);

    const withTime = await readRow(game.id);
    expect(withTime.result).toBe("resign:w");
    await expectUnchanged(
      await act(game.id, game.black, { action: "timeout" }),
      game.id,
      withTime,
    );

    // Clocks at zero used to overwrite the result with a time win.
    await db
      .update(gameSessions)
      .set({ whiteMs: 0, blackMs: 0 })
      .where(eq(gameSessions.id, game.id));
    const flagged = await readRow(game.id);
    await expectUnchanged(
      await act(game.id, game.black, { action: "timeout" }),
      game.id,
      flagged,
    );
    await expectUnchanged(
      await act(game.id, game.white, { action: "timeout" }),
      game.id,
      flagged,
    );
  });

  it("rejects resign and timeout while the game is waiting", async () => {
    const game = await openGame("waiting-actions", { join: false });
    const before = await readRow(game.id);
    expect(before.status).toBe("waiting");
    await expectUnchanged(
      await act(game.id, game.white, { action: "resign" }),
      game.id,
      before,
    );
    await expectUnchanged(
      await act(game.id, game.white, { action: "timeout" }),
      game.id,
      before,
    );

    await db
      .update(gameSessions)
      .set({ whiteMs: 0, blackMs: 0 })
      .where(eq(gameSessions.id, game.id));
    const zeroed = await readRow(game.id);
    await expectUnchanged(
      await act(game.id, game.white, { action: "timeout" }),
      game.id,
      zeroed,
    );
    const after = await readRow(game.id);
    expect(after.status).toBe("waiting");
    expect(after.result).toBeNull();
  });

  it("rejects a move when the game is marked active but a seat is empty", async () => {
    const game = await openGame("active-without-black", { join: false });
    await db
      .update(gameSessions)
      .set({ status: "active" })
      .where(eq(gameSessions.id, game.id));
    const before = await readRow(game.id);
    expect(before.status).toBe("active");
    expect(before.blackJoined).toBe(0);
    await expectUnchanged(
      await act(game.id, game.white, { action: "move", from: "e2", to: "e4" }),
      game.id,
      before,
    );
  });

  it("does not clear a result already stored on an active game", async () => {
    const game = await openGame("result-sticky");
    await db
      .update(gameSessions)
      .set({ result: "1-0" })
      .where(eq(gameSessions.id, game.id));
    const before = await readRow(game.id);
    expect(before.status).toBe("active");
    expect(before.result).toBe("1-0");
    await expectUnchanged(
      await act(game.id, game.white, { action: "move", from: "e2", to: "e4" }),
      game.id,
      before,
    );
    await expectUnchanged(
      await act(game.id, game.black, { action: "resign" }),
      game.id,
      before,
    );
  });

  it("stores only one result when both sides resign together", async () => {
    const game = await openGame("concurrent-resign");
    const [whiteRes, blackRes] = await Promise.all([
      act(game.id, game.white, { action: "resign" }),
      act(game.id, game.black, { action: "resign" }),
    ]);
    const responses = [whiteRes, blackRes];
    const won = responses.filter((res) => res.status === 200);
    const lost = responses.filter((res) => res.status === 409);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    const winner = await readJson<{ status: string; result: string }>(won[0]!);
    const loser = await readJson<ConflictBody>(lost[0]!);
    expect(winner.status).toBe("over");
    expect(["resign:w", "resign:b"]).toContain(winner.result);
    expect(loser.error).toBe("game not active");
    expect(loser.result).toBe(winner.result);
    expect(loser.status).toBe("over");

    const stored = await readRow(game.id);
    expect(stored.status).toBe("over");
    expect(stored.result).toBe(winner.result);
  });

  function sans(pgn: string): string[] {
    if (!pgn.trim()) return [];
    const g = new Chess();
    g.loadPgn(pgn);
    return g.history();
  }

  /** Hold every writer after its read so the updates actually race. */
  function overlapWrites(parties: number): {
    release: () => void;
    arrived: () => number;
  } {
    let seen = 0;
    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    writeBarrier.wait = () => {
      seen += 1;
      if (seen >= parties) open();
      return gate;
    };
    return {
      release: () => {
        writeBarrier.wait = null;
        open();
      },
      arrived: () => seen,
    };
  }

  async function raced<T>(parties: number, run: () => Promise<T>): Promise<T> {
    const gate = overlapWrites(parties);
    try {
      const result = await run();
      expect(gate.arrived()).toBe(parties);
      return result;
    } finally {
      gate.release();
    }
  }

  function expectOneMove(stored: SessionSnap, san: string, from: string, to: string) {
    expect(sans(stored.pgn)).toEqual([san]);
    const g = new Chess();
    g.move({ from, to });
    expect(stored.fen).toBe(g.fen());
    expect(stored.turn).toBe("b");
    expect(stored.status).toBe("active");
    expect(stored.result).toBeNull();
    expect(stored.lastFrom).toBe(from);
    expect(stored.lastTo).toBe(to);
  }

  it("keeps exactly one copy when the same move is posted twice at once", async () => {
    const game = await openGame("concurrent-same-move");
    const [a, b] = await raced(2, () =>
      Promise.all([
        act(game.id, game.white, { action: "move", from: "e2", to: "e4" }),
        act(game.id, game.white, { action: "move", from: "e2", to: "e4" }),
      ]),
    );
    const won = [a, b].filter((res) => res.status === 200);
    const lost = [a, b].filter((res) => res.status === 409);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    const winner = await readJson<SessionSnap>(won[0]!);
    const loser = await readJson<ConflictBody & { pgn: string }>(lost[0]!);
    const stored = await readRow(game.id);
    expectOneMove(stored, "e4", "e2", "e4");
    expect(winner.fen).toBe(stored.fen);
    expect(sans(winner.pgn)).toEqual(["e4"]);
    expect(loser.error).toBe("conflict");
    expect(loser.fen).toBe(stored.fen);
    expect(loser.status).toBe(stored.status);
    expect(loser.result).toBeNull();
    expect(sans(loser.pgn)).toEqual(["e4"]);
  });

  it("keeps exactly one move when two different legal moves are posted at once", async () => {
    const game = await openGame("concurrent-different-moves");
    const [e4, d4] = await raced(2, () =>
      Promise.all([
        act(game.id, game.white, { action: "move", from: "e2", to: "e4" }),
        act(game.id, game.white, { action: "move", from: "d2", to: "d4" }),
      ]),
    );
    const responses = [e4, d4];
    const won = responses.filter((res) => res.status === 200);
    const lost = responses.filter((res) => res.status === 409);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    const winner = await readJson<SessionSnap>(won[0]!);
    const loser = await readJson<ConflictBody & { pgn: string }>(lost[0]!);
    const stored = await readRow(game.id);
    const played = sans(stored.pgn);
    expect(played).toHaveLength(1);
    expect(["e4", "d4"]).toContain(played[0]);
    const from = played[0] === "e4" ? "e2" : "d2";
    const to = played[0] === "e4" ? "e4" : "d4";
    expectOneMove(stored, played[0]!, from, to);
    expect(winner.fen).toBe(stored.fen);
    expect(sans(winner.pgn)).toEqual(played);
    expect(loser.error).toBe("conflict");
    expect(loser.fen).toBe(stored.fen);
    expect(loser.result).toBeNull();
    expect(sans(loser.pgn)).toEqual(played);
  });

  it("keeps the opponent's move when a resign races it", async () => {
    const game = await openGame("resign-races-move");
    let seen = 0;
    let openBoth = () => {};
    const both = new Promise<void>((resolve) => {
      openBoth = resolve;
    });
    let releaseResign = () => {};
    const resignGate = new Promise<void>((resolve) => {
      releaseResign = resolve;
    });
    writeBarrier.wait = async (action) => {
      seen += 1;
      if (seen >= 2) openBoth();
      if (action === "move") {
        if (seen < 2) await both;
        return;
      }
      await resignGate;
    };
    try {
      const moveP = act(game.id, game.white, {
        action: "move",
        from: "e2",
        to: "e4",
      }).then((res) => {
        releaseResign();
        return res;
      });
      const [moveRes, resignRes] = await Promise.all([
        moveP,
        act(game.id, game.black, { action: "resign" }),
      ]);
      expect(seen).toBe(2);
      expect(moveRes.status).toBe(200);
      expect(resignRes.status).toBe(200);
      const stored = await readRow(game.id);
      expect(stored.status).toBe("over");
      expect(stored.result).toBe("resign:b");
      expect(sans(stored.pgn)).toEqual(["e4"]);
      const g = new Chess();
      g.move({ from: "e2", to: "e4" });
      expect(stored.fen).toBe(g.fen());
      expect(stored.lastFrom).toBe("e2");
      expect(stored.lastTo).toBe("e4");
      const resigned = await readJson<{ status: string; result: string; fen: string }>(
        resignRes,
      );
      expect(resigned.status).toBe("over");
      expect(resigned.result).toBe("resign:b");
      expect(resigned.fen).toBe(stored.fen);
    } finally {
      writeBarrier.wait = null;
      openBoth();
      releaseResign();
    }
  });

  it("rejects resign after a result is already stored", async () => {
    const game = await openGame("resign-after-stored-result");
    await db
      .update(gameSessions)
      .set({ result: "1-0" })
      .where(eq(gameSessions.id, game.id));
    const before = await readRow(game.id);
    expect(before.status).toBe("active");
    expect(before.result).toBe("1-0");
    await expectUnchanged(
      await act(game.id, game.white, { action: "resign" }),
      game.id,
      before,
    );
    await expectUnchanged(
      await act(game.id, game.black, { action: "resign" }),
      game.id,
      before,
    );
  });

  it("returns a 409 row with the same shape as GET", async () => {
    const game = await openGame("conflict-shape");
    const move = await act(game.id, game.white, {
      action: "move",
      from: "e2",
      to: "e4",
    });
    expect(move.status).toBe(200);
    const moved = await readJson<Record<string, unknown>>(move);
    const afterMove = await getSession(
      new Request(`http://test/api/session/${game.id}`, {
        headers: bearer(game.white.token),
      }),
      { params: Promise.resolve({ id: game.id }) },
    );
    expect(afterMove.status).toBe(200);
    const viewedMove = await readJson<Record<string, unknown>>(afterMove);
    expect(Object.keys(moved).sort()).toEqual(Object.keys(viewedMove).sort());
    expect(moved).toEqual(viewedMove);

    const resigned = await act(game.id, game.white, { action: "resign" });
    expect(resigned.status).toBe(200);
    const late = await act(game.id, game.black, {
      action: "move",
      from: "e7",
      to: "e5",
    });
    expect(late.status).toBe(409);
    const conflictBody = await readJson<Record<string, unknown>>(late);
    const afterConflict = await getSession(
      new Request(`http://test/api/session/${game.id}`, {
        headers: bearer(game.black.token),
      }),
      { params: Promise.resolve({ id: game.id }) },
    );
    const viewed = await readJson<Record<string, unknown>>(afterConflict);
    expect(conflictBody.error).toBe("game not active");
    const conflictRow = { ...conflictBody };
    delete conflictRow.error;
    expect(Object.keys(conflictRow).sort()).toEqual(Object.keys(viewed).sort());
    expect(conflictRow).toEqual(viewed);
    for (const key of [
      "id",
      "fen",
      "pgn",
      "turn",
      "status",
      "result",
      "blackJoined",
      "lastFrom",
      "lastTo",
      "whiteMs",
      "blackMs",
      "updatedAt",
      "createdAt",
      "timeControlMin",
      "seats",
      "claimed",
      "color",
      "seatToken",
      "myUserId",
    ]) {
      expect(conflictRow).toHaveProperty(key);
      expect(conflictRow[key]).toEqual(viewed[key]);
    }
    expect(conflictRow.myUserId).toBeTruthy();
    expect(conflictRow).not.toHaveProperty("whiteUserId");
    expect(conflictRow).not.toHaveProperty("blackUserId");
  });

  it("hides seat UUIDs from spectators", async () => {
    const game = await openGame("spectator-redact", { join: true });
    const view = await getSession(
      new Request(`http://test/api/session/${game.id}`),
      { params: Promise.resolve({ id: game.id }) },
    );
    expect(view.status).toBe(200);
    const body = await readJson<Record<string, unknown>>(view);
    expect(body).not.toHaveProperty("whiteUserId");
    expect(body).not.toHaveProperty("blackUserId");
    expect(body.seats).toBeTruthy();
  });

  it("does not let a join reopen a finished unseated game", async () => {
    const game = await openGame("join-finished", { join: false });
    await db
      .update(gameSessions)
      .set({ status: "over", result: "1-0" })
      .where(eq(gameSessions.id, game.id));

    const join = await getSession(
      new Request(`http://test/api/session/${game.id}?join=1`, {
        headers: bearer(game.black.token),
      }),
      { params: Promise.resolve({ id: game.id }) },
    );
    expect(join.status).toBe(200);
    const body = await readJson<{
      claimed: boolean;
      status: string;
      result: string | null;
      blackJoined: number;
    }>(join);
    expect(body.claimed).toBe(false);
    expect(body.status).toBe("over");
    expect(body.result).toBe("1-0");
    expect(body.blackJoined).toBe(0);

    const stored = await readRow(game.id);
    expect(stored.status).toBe("over");
    expect(stored.result).toBe("1-0");
    expect(stored.blackJoined).toBe(0);
  });
});
