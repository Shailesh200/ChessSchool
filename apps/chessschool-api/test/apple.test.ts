import { createHash, createSign, generateKeyPairSync, type JsonWebKey, type KeyObject } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { completeNode, createInitialState, type AuthResponse, type Progress } from "@chessschool/design";
import { createApp } from "../src/app";
import { appleVerifierFromEnv, createAppleVerifier, type AppleJwk } from "../src/apple";
import { openDb } from "../src/db";
import type { GoogleVerifier } from "../src/google";
import { profiles, progress, sessions, users } from "../src/schema";

const AUD = "app.example";
const NOW = 1_700_000_000_000;
const RAW_NONCE = "raw-nonce-value";

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
  const payload: Record<string, unknown> = {
    iss: "https://appleid.apple.com",
    aud: AUD,
    iat: seconds - 10,
    exp: seconds + 3600,
    sub: "apple-user-1",
    email: "Ada@Example.com",
    email_verified: true,
    nonce: nonceHash(RAW_NONCE),
    ...over,
  };
  if (payload.nonce === undefined) delete payload.nonce;
  return payload;
}

function nonceHash(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

function guestProgress(ids: string[], name = "Asha") {
  let state = createInitialState("guest-apple");
  for (const id of ids) state = completeNode(state, id, new Date(NOW));
  return {
    guestId: state.guestId,
    profile: { name, dailyMinutes: 15 as const, who: "child" as const },
    progress: state.progress,
  };
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

  async function post(app: ReturnType<typeof createApp>, body: Record<string, unknown>, ip = "4.4.4.4") {
    const res = await app.request("/v1/auth/apple", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ nonce: RAW_NONCE, ...body }),
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

  it("requires a raw nonce that matches the token claim", async () => {
    const { app } = await appWith();
    const good = sign(claims({ sub: "nonce-user", email: "nonce@example.com" }), pair.privateKey, "test-key");
    expect((await post(app, { identityToken: good, nonce: RAW_NONCE, fullName: { givenName: "Nia" } }, "4.4.8.1")).status).toBe(200);
    const mismatch = sign(claims({ nonce: nonceHash("other"), sub: "nonce-user-2", email: "nonce2@example.com" }), pair.privateKey, "test-key");
    expect((await post(app, { identityToken: mismatch, nonce: RAW_NONCE }, "4.4.8.2")).json.error).toBe("apple_invalid");
    const missing = await app.request("/v1/auth/apple", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "4.4.8.3" },
      body: JSON.stringify({ identityToken: good }),
    });
    expect(((await missing.json()) as { error: string }).error).toBe("apple_invalid");
    expect((await post(app, { identityToken: good, nonce: "" }, "4.4.8.4")).json.error).toBe("apple_invalid");
    const noClaim = sign(claims({ nonce: undefined, sub: "nonce-user-3", email: "nonce3@example.com" }), pair.privateKey, "test-key");
    expect((await post(app, { identityToken: noClaim, nonce: RAW_NONCE }, "4.4.8.5")).json.error).toBe("apple_invalid");
  });

  it("does not attach Apple to an existing email, verified or not, and still signs in on sub", async () => {
    const { db, app } = await appWith();
    const ada = await app.request("/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "4.4.9.1" },
      body: JSON.stringify({ name: "Ada", email: "ada@example.com", password: "pawnpawn" }),
    });
    const adaJson = (await ada.json()) as AuthResponse;
    await app.request("/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "4.4.9.2" },
      body: JSON.stringify({ name: "Bea", email: "bea@example.com", password: "pawnpawn" }),
    });
    const adaBefore = await db.query.users.findFirst({ where: eq(users.email, "ada@example.com") });
    const verified = await post(app, { identityToken: sign(claims({ email_verified: "true" }), pair.privateKey, "test-key") }, "4.4.9.3");
    expect(verified.status).toBe(409);
    expect(verified.json.error).toBe("email_in_use");
    expect(await db.query.users.findFirst({ where: eq(users.email, "ada@example.com") })).toEqual(adaBefore);
    expect(await db.query.users.findFirst({ where: eq(users.appleSub, "apple-user-1") })).toBeUndefined();

    const beaBefore = await db.query.users.findFirst({ where: eq(users.email, "bea@example.com") });
    const unverified = await post(app, { identityToken: sign(claims({ sub: "apple-user-2", email: "bea@example.com", email_verified: false }), pair.privateKey, "test-key") }, "4.4.9.4");
    expect(unverified.status).toBe(409);
    expect(unverified.json.error).toBe("email_in_use");
    expect(await db.query.users.findFirst({ where: eq(users.email, "bea@example.com") })).toEqual(beaBefore);
    expect(await db.query.users.findFirst({ where: eq(users.appleSub, "apple-user-2") })).toBeUndefined();

    const created = await post(app, { identityToken: sign(claims({ sub: "apple-user-3", email: "fresh@example.com" }), pair.privateKey, "test-key"), fullName: { givenName: "Fresh" } }, "4.4.9.5");
    const again = await post(app, { identityToken: sign(claims({ sub: "apple-user-3", email: "fresh@example.com" }), pair.privateKey, "test-key") }, "4.4.9.6");
    expect(again.status).toBe(200);
    expect(again.json.user.id).toBe(created.json.user.id);
    expect(adaJson.user.email).toBe("ada@example.com");
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

describe("Apple guest merge matches Google", () => {
  async function post(app: ReturnType<typeof createApp>, path: string, body: unknown, ip: string) {
    const res = await app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as AuthResponse & { error?: string } };
  }

  it("stores a new Apple user's guest progress and uses the guest name", async () => {
    const db = await openDb(":memory:");
    const apple = async () => ({ sub: "apple-new", email: "new@example.com", emailVerified: true });
    const app = createApp({ db, google: null, apple, secureCookies: false, corsOrigins: [], now: () => new Date(NOW) });
    const guest = guestProgress(["meet"]);
    const created = await post(app, "/v1/auth/apple", { identityToken: "tok", nonce: RAW_NONCE, fullName: { givenName: "Other", familyName: "Name" }, guest }, "5.0.0.1");
    expect(created.status).toBe(200);
    expect(created.json.user.name).toBe("Asha");
    expect(created.json.profile).toMatchObject({ name: "Asha", who: "child", dailyMinutes: 15 });
    expect(created.json.progress.completed.meet).toBe(guest.progress.completed.meet);
    expect(created.json.progress.xp).toBe(guest.progress.xp);
    const row = await db.query.progress.findFirst({ where: eq(progress.userId, created.json.user.id) });
    expect(JSON.parse(row?.data ?? "{}")).toMatchObject({ completed: { meet: guest.progress.completed.meet }, xp: guest.progress.xp });
  });

  it("merges guest progress into an existing Apple sub without doubling XP", async () => {
    const db = await openDb(":memory:");
    const apple = async () => ({ sub: "apple-back", email: "back@example.com", emailVerified: true });
    const app = createApp({ db, google: null, apple, secureCookies: false, corsOrigins: [], now: () => new Date(NOW) });
    const first = guestProgress(["meet"]);
    const created = await post(app, "/v1/auth/apple", { identityToken: "tok", nonce: RAW_NONCE, guest: first }, "5.0.1.1");
    const wider = guestProgress(["meet", "board"]);
    const again = await post(app, "/v1/auth/apple", { identityToken: "tok", nonce: RAW_NONCE, guest: wider }, "5.0.1.2");
    expect(again.json.user.id).toBe(created.json.user.id);
    expect(again.json.progress.completed.meet).toBe(first.progress.completed.meet);
    expect(again.json.progress.completed.board).toBe(wider.progress.completed.board);
    expect(again.json.progress.xp).toBe(wider.progress.xp);
    const repeat = await post(app, "/v1/auth/apple", { identityToken: "tok", nonce: RAW_NONCE, guest: wider }, "5.0.1.3");
    expect(repeat.json.progress.xp).toBe(again.json.progress.xp);
    expect(repeat.json.progress.completed).toEqual(again.json.progress.completed);
    const row = await db.query.progress.findFirst({ where: eq(progress.userId, created.json.user.id) });
    expect(JSON.parse(row?.data ?? "{}").xp).toBe(wider.progress.xp);
  });

  it("does not merge a guest into an account that already owns the email", async () => {
    const db = await openDb(":memory:");
    const apple = async () => ({ sub: "apple-link", email: "ada@example.com", emailVerified: true });
    const app = createApp({ db, google: null, apple, secureCookies: false, corsOrigins: [], now: () => new Date(NOW) });
    const registered = await post(app, "/v1/auth/register", { name: "Ada", email: "ada@example.com", password: "pawnpawn", guest: guestProgress(["meet"]) }, "5.0.2.1");
    const beforeUser = await db.query.users.findFirst({ where: eq(users.id, registered.json.user.id) });
    const beforeProgress = await db.query.progress.findFirst({ where: eq(progress.userId, registered.json.user.id) });
    const beforeSessions = await db.select().from(sessions).where(eq(sessions.userId, registered.json.user.id));
    const blocked = await post(app, "/v1/auth/apple", { identityToken: "tok", nonce: RAW_NONCE, guest: guestProgress(["meet", "board"]) }, "5.0.2.2");
    expect(blocked.status).toBe(409);
    expect(blocked.json.error).toBe("email_in_use");
    expect(await db.query.users.findFirst({ where: eq(users.id, registered.json.user.id) })).toEqual(beforeUser);
    expect(await db.query.progress.findFirst({ where: eq(progress.userId, registered.json.user.id) })).toEqual(beforeProgress);
    expect(await db.select().from(sessions).where(eq(sessions.userId, registered.json.user.id))).toEqual(beforeSessions);
    expect(beforeUser?.appleSub).toBeNull();
  });

  it("returns the same progress and profile for one guest payload on Google and Apple", async () => {
    const db = await openDb(":memory:");
    const guest = guestProgress(["meet", "board"], "Asha");
    const google: GoogleVerifier = async (token) => (token === "google-token" ? { sub: "g-parity", email: "parity-g@example.com", emailVerified: true, name: "From Google" } : null);
    const apple = async (token: string) => (token === "apple-token" ? { sub: "a-parity", email: "parity-a@example.com", emailVerified: true } : null);
    const app = createApp({ db, google, apple, secureCookies: false, corsOrigins: [], now: () => new Date(NOW) });
    const byGoogle = await post(app, "/v1/auth/google", { idToken: "google-token", guest }, "5.0.3.1");
    const byApple = await post(app, "/v1/auth/apple", { identityToken: "apple-token", nonce: RAW_NONCE, fullName: { givenName: "Other" }, guest }, "5.0.3.2");
    expect(byGoogle.status).toBe(200);
    expect(byApple.status).toBe(200);
    expect(byApple.json.user.name).toBe(byGoogle.json.user.name);
    expect(byApple.json.profile).toEqual(byGoogle.json.profile);
    expect(byApple.json.progress).toEqual(byGoogle.json.progress);
    const stored = async (id: string) => JSON.parse((await db.query.progress.findFirst({ where: eq(progress.userId, id) }))?.data ?? "{}") as Progress;
    expect(await stored(byApple.json.user.id)).toEqual(await stored(byGoogle.json.user.id));
  });
});
