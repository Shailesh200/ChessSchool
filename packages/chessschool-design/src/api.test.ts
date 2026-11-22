import { describe, expect, it } from "vitest";
import { copy } from "./copy";
import { ApiError, createApiClient, errorMessage, isGuestClassLimit } from "./api";

describe("guest class limit", () => {
  it("matches only a 403 with code GUEST_CLASS_LIMIT", () => {
    expect(isGuestClassLimit(new ApiError(403, "GUEST_CLASS_LIMIT"))).toBe(true);
    expect(isGuestClassLimit(new ApiError(403, "not_found"))).toBe(false);
    expect(isGuestClassLimit(new ApiError(401, "unauthorized"))).toBe(false);
    expect(isGuestClassLimit(new Error("GUEST_CLASS_LIMIT"))).toBe(false);
  });
});

const EMAIL_IN_USE = "This email already has an account. Sign in with email instead.";

function client(path: string) {
  return createApiClient({
    baseUrl: "https://api.test",
    fetchImpl: async (input) => {
      expect(String(input)).toBe(`https://api.test${path}`);
      return new Response(JSON.stringify({ error: "email_in_use" }), { status: 409, headers: { "Content-Type": "application/json" } });
    },
  });
}

describe("email_in_use", () => {
  it("maps a 409 from Apple and Google sign-in to the auth copy", async () => {
    expect(copy.auth.emailInUse).toBe(EMAIL_IN_USE);
    for (const run of [() => client("/v1/auth/apple").apple({ identityToken: "token" }), () => client("/v1/auth/google").google({ idToken: "token" })]) {
      const err = await run().catch((e: unknown) => e);
      expect(err).toMatchObject({ status: 409, code: "email_in_use" });
      expect(errorMessage(err)).toBe(EMAIL_IN_USE);
      expect(errorMessage(err)).not.toBe(copy.auth.errors.generic);
      expect(errorMessage(err)).not.toBe(copy.auth.errors.offline);
    }
  });
});

describe("quiet retries", () => {
  const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  function make(responses: (Response | Error)[]) {
    const calls: string[] = [];
    const reach: boolean[] = [];
    const api = createApiClient({
      baseUrl: "https://api.test",
      retryDelaysMs: [0, 0],
      onReach: (r) => reach.push(r),
      fetchImpl: async (input, init) => {
        calls.push(`${init?.method} ${String(input)}`);
        const next = responses.shift() ?? json(200);
        if (next instanceof Error) throw next;
        return next;
      },
    });
    return { api, calls, reach };
  }

  it("retries a GET that got no answer or a gateway error, then succeeds", async () => {
    const { api, calls, reach } = make([new TypeError("network"), json(503), json(200, { features: {} })]);
    await expect(api.features()).resolves.toEqual({ features: {} });
    expect(calls).toHaveLength(3);
    expect(reach).toEqual([true]);
  });

  it("never retries a 4xx or a POST, and a 4xx counts as reaching the API", async () => {
    const a = make([json(404, { error: "not_found" })]);
    await expect(a.api.features()).rejects.toMatchObject({ status: 404 });
    expect(a.calls).toHaveLength(1);
    expect(a.reach).toEqual([true]);
    const b = make([new TypeError("network")]);
    await expect(b.api.addFriend("x")).rejects.toMatchObject({ status: 0, code: "offline" });
    expect(b.calls).toHaveLength(1);
    expect(b.reach).toEqual([false]);
  });

  it("gives up after the retries and reports no answer once", async () => {
    const { api, calls, reach } = make([new TypeError("a"), new TypeError("b"), new TypeError("c")]);
    await expect(api.me()).rejects.toMatchObject({ status: 0 });
    expect(calls).toHaveLength(3);
    expect(reach).toEqual([false]);
  });

  it("the health probe is a single try (the connectivity watch retries)", async () => {
    const { api, calls } = make([new TypeError("a")]);
    await expect(api.health()).rejects.toMatchObject({ status: 0 });
    expect(calls).toHaveLength(1);
  });
});
