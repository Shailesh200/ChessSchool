import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bootApiTestEnv, bearer, readJson, testIp } from "@/lib/test-db.harness";

const FAKE_ABLY_KEY = "unit-test-ably-key";
const PW = "testpass123";
const TOKEN_TTL_MS = 60 * 60 * 1000;
/** Matches TOKEN_RATE.limit in app/api/ably-token/route.ts */
const TOKEN_RATE_LIMIT = 30;

const { createTokenRequest } = vi.hoisted(() => ({
  createTokenRequest: vi.fn(
    async (params: { capability: Record<string, string[]>; ttl?: number }) => ({
      keyName: "unit-test",
      ttl: params.ttl,
      capability: JSON.stringify(params.capability),
      nonce: "nonce",
      mac: "mac",
      timestamp: 1,
    }),
  ),
}));

vi.mock("ably", () => {
  class Rest {
    auth = { createTokenRequest };
    channels = {
      get: () => ({ publish: async () => undefined }),
    };
  }
  return { default: { Rest } };
});

type TokenBody = {
  capability: string;
  ttl?: number;
  mac?: string;
};

function tokenUrl(game: string | null, extra = ""): string {
  if (game === null) return `http://test/api/ably-token${extra}`;
  return `http://test/api/ably-token?game=${encodeURIComponent(game)}${extra}`;
}

function authed(token: string, slot: number): Record<string, string> {
  return { ...bearer(token), ...testIp(slot) };
}

describe("ably token API integration", () => {
  const originalKey = process.env.ABLY_API_KEY;
  let teardown: () => void = () => {};
  let postRegister: typeof import("@/app/api/auth/register/route").POST;
  let postSession: typeof import("@/app/api/session/route").POST;
  let getSession: typeof import("@/app/api/session/[id]/route").GET;
  let getToken: typeof import("@/app/api/ably-token/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    createTokenRequest.mockClear();
    process.env.ABLY_API_KEY = FAKE_ABLY_KEY;
    ({ teardown } = await bootApiTestEnv());
    postRegister = (await import("@/app/api/auth/register/route")).POST;
    postSession = (await import("@/app/api/session/route")).POST;
    getSession = (await import("@/app/api/session/[id]/route")).GET;
    getToken = (await import("@/app/api/ably-token/route")).GET;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ABLY_API_KEY;
    else process.env.ABLY_API_KEY = originalKey;
    teardown();
    vi.resetModules();
  });

  async function register(email: string, slot: number): Promise<string> {
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

  async function createGame(token: string, slot: number): Promise<string> {
    const res = await postSession(
      new Request("http://test/api/session", {
        method: "POST",
        headers: authed(token, slot),
      }),
    );
    expect(res.status).toBe(200);
    const { id } = await readJson<{ id: string }>(res);
    return id;
  }

  it("returns 401 for anonymous callers", async () => {
    const stamp = Date.now();
    const white = await register(`ably-anon-w-${stamp}@test.dev`, 80);
    const id = await createGame(white, 81);

    const noHeader = await getToken(new Request(tokenUrl(id), { headers: testIp(82) }));
    expect(noHeader.status).toBe(401);
    expect(await readJson<{ error: string }>(noHeader)).toEqual({
      error: "login required",
    });

    const badBearer = await getToken(
      new Request(tokenUrl(id), {
        headers: { ...bearer("not-a-session"), ...testIp(83) },
      }),
    );
    expect(badBearer.status).toBe(401);
    expect(createTokenRequest).not.toHaveBeenCalled();
  });

  it("returns 400 when the game id is missing", async () => {
    const token = await register(`ably-noid-${Date.now()}@test.dev`, 84);
    const res = await getToken(
      new Request(tokenUrl(null), { headers: authed(token, 85) }),
    );
    expect(res.status).toBe(400);
    expect(await readJson<{ error: string }>(res)).toEqual({
      error: "game id required",
    });

    const empty = await getToken(
      new Request(tokenUrl(""), { headers: authed(token, 85) }),
    );
    expect(empty.status).toBe(400);
    expect(createTokenRequest).not.toHaveBeenCalled();
  });

  it("returns 400 when the game id is invalid", async () => {
    const token = await register(`ably-badid-${Date.now()}@test.dev`, 86);
    for (const game of ["*", "game:*", "not-a-uuid", `${randomUUID()}x`]) {
      const res = await getToken(
        new Request(tokenUrl(game), { headers: authed(token, 87) }),
      );
      expect(res.status).toBe(400);
      expect(await readJson<{ error: string }>(res)).toEqual({
        error: "invalid game id",
      });
    }
    expect(createTokenRequest).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller has no seat", async () => {
    const stamp = Date.now();
    const white = await register(`ably-seat-w-${stamp}@test.dev`, 88);
    const stranger = await register(`ably-seat-s-${stamp}@test.dev`, 89);
    const id = await createGame(white, 90);

    const other = await getToken(
      new Request(tokenUrl(id), { headers: authed(stranger, 91) }),
    );
    expect(other.status).toBe(403);
    expect(await readJson<{ error: string }>(other)).toEqual({
      error: "not a participant",
    });

    const missing = await getToken(
      new Request(tokenUrl(randomUUID()), { headers: authed(white, 92) }),
    );
    expect(missing.status).toBe(403);
    expect(createTokenRequest).not.toHaveBeenCalled();
  });

  it("returns a token whose capability is exactly that game channel", async () => {
    const stamp = Date.now();
    const white = await register(`ably-ok-w-${stamp}@test.dev`, 93);
    const black = await register(`ably-ok-b-${stamp}@test.dev`, 94);
    const id = await createGame(white, 95);
    const hostile = `&capability=${encodeURIComponent('{"*":["*"]}')}&ttl=999999999`;

    const whiteRes = await getToken(
      new Request(tokenUrl(id.toUpperCase(), hostile), {
        headers: authed(white, 96),
      }),
    );
    expect(whiteRes.status).toBe(200);
    const whiteBody = await readJson<TokenBody>(whiteRes);
    expect(JSON.parse(whiteBody.capability)).toEqual({
      [`game:${id}`]: ["subscribe"],
    });
    expect(whiteBody.ttl).toBe(TOKEN_TTL_MS);
    expect(createTokenRequest).toHaveBeenCalledTimes(1);
    expect(createTokenRequest).toHaveBeenCalledWith({
      ttl: TOKEN_TTL_MS,
      capability: { [`game:${id}`]: ["subscribe"] },
    });

    const join = await getSession(
      new Request(`http://test/api/session/${id}?join=1`, {
        headers: bearer(black),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(join.status).toBe(200);

    const blackRes = await getToken(
      new Request(tokenUrl(id), { headers: authed(black, 97) }),
    );
    expect(blackRes.status).toBe(200);
    const blackBody = await readJson<TokenBody>(blackRes);
    expect(JSON.parse(blackBody.capability)).toEqual({
      [`game:${id}`]: ["subscribe"],
    });
    expect(JSON.stringify(blackBody)).not.toContain("game:*");
    expect(JSON.stringify(blackBody)).not.toContain('"*"');

    const calls = createTokenRequest.mock.calls.map((call) => call[0]);
    expect(calls).toEqual([
      { ttl: TOKEN_TTL_MS, capability: { [`game:${id}`]: ["subscribe"] } },
      { ttl: TOKEN_TTL_MS, capability: { [`game:${id}`]: ["subscribe"] } },
    ]);
  });

  it("rate limits token requests per user", async () => {
    const token = await register(`ably-rate-${Date.now()}@test.dev`, 98);
    const headers = authed(token, 99);
    for (let i = 0; i < TOKEN_RATE_LIMIT; i++) {
      const res = await getToken(new Request(tokenUrl(null), { headers }));
      expect(res.status).toBe(400);
    }
    const blocked = await getToken(new Request(tokenUrl(null), { headers }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(createTokenRequest).not.toHaveBeenCalled();
  });

  it("returns 503 when Ably is not configured", async () => {
    delete process.env.ABLY_API_KEY;
    const token = await register(`ably-off-${Date.now()}@test.dev`, 100);
    const id = await createGame(token, 101);
    const res = await getToken(
      new Request(tokenUrl(id), { headers: authed(token, 102) }),
    );
    expect(res.status).toBe(503);
    expect(await readJson<{ error: string }>(res)).toEqual({
      error: "ably_not_configured",
    });
    expect(createTokenRequest).not.toHaveBeenCalled();
  });

  it("returns 500 without echoing mint failures", async () => {
    createTokenRequest.mockRejectedValueOnce(
      new Error(`signing failed ${FAKE_ABLY_KEY}`),
    );
    const token = await register(`ably-fail-${Date.now()}@test.dev`, 103);
    const id = await createGame(token, 104);
    const res = await getToken(
      new Request(tokenUrl(id), { headers: authed(token, 105) }),
    );
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("token_failed");
    expect(text).not.toContain(FAKE_ABLY_KEY);
    expect(text).not.toContain("signing failed");
  });
});
