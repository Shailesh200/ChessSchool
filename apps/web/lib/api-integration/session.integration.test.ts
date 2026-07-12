import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { gameSessions } from "@/db/schema";
import { bootApiTestEnv, bearer, readJson, testIp, type TestDb } from "@/lib/test-db.harness";

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

  beforeEach(async () => {
    vi.resetModules();
    ({ teardown, db } = await bootApiTestEnv());
    postRegister = (await import("@/app/api/auth/register/route")).POST;
    postSession = (await import("@/app/api/session/route")).POST;
    const sessionIdMod = await import("@/app/api/session/[id]/route");
    getSession = sessionIdMod.GET;
    postSessionMove = sessionIdMod.POST;
  });

  afterEach(() => {
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
    const whiteToken = await register(postRegister, `timeout-white-${stamp}@test.dev`, 71);
    const blackToken = await register(postRegister, `timeout-black-${stamp}@test.dev`, 72);

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
});
