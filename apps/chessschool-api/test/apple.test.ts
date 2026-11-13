import { createHash, createSign, generateKeyPairSync, type JsonWebKey, type KeyObject } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { AuthResponse } from "@chessschool/design";
import { createApp } from "../src/app";
import { appleVerifierFromEnv, createAppleVerifier, type AppleJwk } from "../src/apple";
import { openDb } from "../src/db";
import { profiles, progress, sessions, users } from "../src/schema";

const AUD = "app.example";
const NOW = 1_700_000_000_000;

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });

function jwk(publicKey: KeyObject, kid: string): AppleJwk {
  const exported = publicKey.export({ format: "jwk" }) as JsonWebKey;
  return { ...exported, kid, alg: "RS256", use: "sig" };
}

function sign(payload: Record<string, unknown>, privateKey: KeyObject, kid: string) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${header}.${body}`;
  const signature = createSign("RSA-SHA256").update(data).sign(privateKey).toString("base64url");
  return `${data}.${signature}`;
}

function claims(over: Record<string, unknown> = {}) {
  const seconds = Math.floor(NOW / 1000);
  return { iss: "https://appleid.apple.com", aud: AUD, iat: seconds - 10, exp: seconds + 3600, sub: "apple-user-1", email: "Ada@Example.com", email_verified: true, ...over };
}

function nonceHash(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

describe("APPLE_CLIENT_IDS", () => {
  it("fails closed when the list is missing, empty, or only commas", () => {
    for (const raw of [undefined, "", "   ", " , , ", ",,"]) expect(appleVerifierFromEnv({ APPLE_CLIENT_IDS: raw })).toBeNull();
    expect(appleVerifierFromEnv({ APPLE_CLIENT_IDS: ` ${AUD} ` })).not.toBeNull();
  });
});

describe("POST /v1/auth/apple", () => {
  const key = jwk(pair.publicKey, "test-key");
  let fetches = 0;
  const fetchJwks = async () => {
    fetches += 1;
    return { keys: [key] };
  };

  async function appWith(keys: () => Promise<{ keys: AppleJwk[] }> = fetchJwks, now = () => NOW) {
    const db = await openDb(":memory:");
    const apple = createAppleVerifier([AUD], { fetchJwks: keys, now, ttlMs: 1_000 });
    const app = createApp({ db, google: null, apple, secureCookies: false, corsOrigins: [], now: () => new Date(NOW) });
    return { db, app };
  }

  async function post(app: ReturnType<typeof createApp>, body: unknown, ip = "4.4.4.4") {
    const res = await app.request("/v1/auth/apple", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as AuthResponse & { error?: string } };
  }

  it("creates an account from a valid token and keeps the name on the next sign-in", async () => {
    fetches = 0;
    const { db, app } = await appWith();
    const token = sign(claims(), pair.privateKey, "test-key");
    const created = await post(app, {
      identityToken: token,
      fullName: { givenName: "Ada", familyName: "Lovelace" },
      email: "someone-else@example.com",
    });
    expect(created.status).toBe(200);
    expect(created.json.user).toMatchObject({ email: "ada@example.com", name: "Ada Lovelace", provider: "apple" });
    expect(created.json.token).toEqual(expect.any(String));
    expect(fetches).toBe(1);

    const again = await post(app, { identityToken: sign(claims({ email: undefined, email_verified: undefined }), pair.privateKey, "test-key") }, "4.4.4.5");
    expect(again.status).toBe(200);
    expect(again.json.user).toMatchObject({ id: created.json.user.id, email: "ada@example.com", name: "Ada Lovelace" });
    expect(fetches).toBe(1);
    const row = await db.query.users.findFirst({ where: eq(users.appleSub, "apple-user-1") });
    expect(row?.email).toBe("ada@example.com");
  });

  it("rejects a bad signature, the wrong audience, the wrong issuer, and an expired token", async () => {
    const { app } = await appWith();
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const cases = [
      sign(claims(), other.privateKey, "test-key"),
      sign(claims({ aud: "other.example" }), pair.privateKey, "test-key"),
      sign(claims({ iss: "https://example.com" }), pair.privateKey, "test-key"),
      sign(claims({ exp: Math.floor(NOW / 1000) - 120 }), pair.privateKey, "test-key"),
    ];
    for (const [i, identityToken] of cases.entries()) {
      const res = await post(app, { identityToken }, `4.4.5.${i}`);
      expect(res.status).toBe(401);
      expect(res.json.error).toBe("apple_invalid");
    }
  });

  it("accepts a token inside the clock skew and rejects one issued too far ahead", async () => {
    const { app } = await appWith();
    const seconds = Math.floor(NOW / 1000);
    const soon = await post(app, { identityToken: sign(claims({ exp: seconds - 30, sub: "skew-user", email: "skew@example.com" }), pair.privateKey, "test-key"), fullName: { givenName: "Skew" } }, "4.4.6.1");
    expect(soon.status).toBe(200);
    const future = await post(app, { identityToken: sign(claims({ iat: seconds + 120, sub: "future-user", email: "future@example.com" }), pair.privateKey, "test-key") }, "4.4.6.2");
    expect(future.status).toBe(401);
  });

  it("refetches JWKS once when the key id is unknown, then uses the cache", async () => {
    let calls = 0;
    const fetchKeys = async () => {
      calls += 1;
      return { keys: calls === 1 ? [jwk(pair.publicKey, "old-key")] : [key] };
    };
    let clock = NOW;
    const { app } = await appWith(fetchKeys, () => clock);
    const token = sign(claims({ sub: "kid-user", email: "kid@example.com" }), pair.privateKey, "test-key");
    expect((await post(app, { identityToken: token, fullName: { givenName: "Kid" } }, "4.4.7.1")).status).toBe(200);
    expect(calls).toBe(2);
    expect((await post(app, { identityToken: token }, "4.4.7.2")).status).toBe(200);
    expect(calls).toBe(2);
    clock += 2_000;
    expect((await post(app, { identityToken: token }, "4.4.7.3")).status).toBe(200);
    expect(calls).toBe(3);
  });

  it("checks the raw nonce against the sha256 hex claim", async () => {
    const { app } = await appWith();
    const raw = "raw-nonce-value";
    const good = sign(claims({ nonce: nonceHash(raw), sub: "nonce-user", email: "nonce@example.com" }), pair.privateKey, "test-key");
    expect((await post(app, { identityToken: good, nonce: raw, fullName: { givenName: "Nia" } }, "4.4.8.1")).status).toBe(200);
    const bad = sign(claims({ nonce: nonceHash("other"), sub: "nonce-user-2", email: "nonce2@example.com" }), pair.privateKey, "test-key");
    expect((await post(app, { identityToken: bad, nonce: raw }, "4.4.8.2")).json.error).toBe("apple_invalid");
  });

  it("links a verified email and refuses an unverified one", async () => {
    const { db, app } = await appWith();
    await app.request("/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "4.4.9.1" },
      body: JSON.stringify({ name: "Ada", email: "ada@example.com", password: "pawnpawn" }),
    });
    await app.request("/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "4.4.9.2" },
      body: JSON.stringify({ name: "Bea", email: "bea@example.com", password: "pawnpawn" }),
    });
    const linked = await post(app, { identityToken: sign(claims({ email_verified: "true" }), pair.privateKey, "test-key") }, "4.4.9.3");
    expect(linked.status).toBe(200);
    expect(linked.json.user).toMatchObject({ email: "ada@example.com", provider: "password" });
    expect((await db.query.users.findFirst({ where: eq(users.email, "ada@example.com") }))?.appleSub).toBe("apple-user-1");

    const refused = await post(
      app,
      { identityToken: sign(claims({ sub: "apple-user-2", email: "bea@example.com", email_verified: false }), pair.privateKey, "test-key") },
      "4.4.9.4",
    );
    expect(refused.status).toBe(401);
    expect((await db.query.users.findFirst({ where: eq(users.email, "bea@example.com") }))?.appleSub).toBeNull();
    expect(await db.query.users.findFirst({ where: eq(users.appleSub, "apple-user-2") })).toBeUndefined();
  });

  it("returns 503 when Apple client ids are unset", async () => {
    const db = await openDb(":memory:");
    const app = createApp({ db, google: null, apple: null, secureCookies: false, corsOrigins: [], now: () => new Date(NOW) });
    const res = await post(app, { identityToken: "anything" });
    expect(res.status).toBe(503);
    expect(res.json.error).toBe("apple_unconfigured");
  });

  it("removes the Apple link and every session when the account is deleted", async () => {
    const { db, app } = await appWith();
    const token = sign(claims({ sub: "apple-delete", email: "del@example.com" }), pair.privateKey, "test-key");
    const created = await post(app, { identityToken: token, fullName: { givenName: "Del" } }, "4.4.10.1");
    const second = await post(app, { identityToken: token }, "4.4.10.2");
    const id = created.json.user.id;
    await app.request("/v1/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${created.json.token}`, "x-forwarded-for": "4.4.10.3" },
      body: JSON.stringify({ progress: { completed: {}, xp: 0, streak: { count: 0, lastDay: null }, minutes: { day: null, value: 0 } } }),
    });
    const removed = await app.request("/v1/me", { method: "DELETE", headers: { Authorization: `Bearer ${created.json.token}` } });
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ ok: true });
    expect((await app.request("/v1/me", { headers: { Authorization: `Bearer ${created.json.token}` } })).status).toBe(401);
    expect((await app.request("/v1/me", { headers: { Authorization: `Bearer ${second.json.token}` } })).status).toBe(401);
    expect(await db.select().from(users).where(eq(users.id, id))).toEqual([]);
    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toEqual([]);
    expect(await db.select().from(progress).where(eq(progress.userId, id))).toEqual([]);
    expect(await db.select().from(profiles).where(eq(profiles.userId, id))).toEqual([]);
    expect(await db.query.users.findFirst({ where: eq(users.appleSub, "apple-delete") })).toBeUndefined();
  });
});
