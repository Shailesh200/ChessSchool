import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { analyticsEvents, users, webVitals } from "@/db/schema";
import { bootApiTestEnv, bearer, readJson, testIp, type TestDb } from "@/lib/test-db.harness";

const PW = "testpass123";

describe("auth API integration", () => {
  let teardown: () => void = () => {};
  let db: TestDb;
  let postRegister: typeof import("@/app/api/auth/register/route").POST;
  let postLogin: typeof import("@/app/api/auth/login/route").POST;
  let postLogout: typeof import("@/app/api/auth/logout/route").POST;
  let getMe: typeof import("@/app/api/auth/me/route").GET;
  let getUserByToken: typeof import("@/lib/auth").getUserByToken;

  beforeEach(async () => {
    vi.resetModules();
    ({ teardown, db } = await bootApiTestEnv());
    postRegister = (await import("@/app/api/auth/register/route")).POST;
    postLogin = (await import("@/app/api/auth/login/route")).POST;
    postLogout = (await import("@/app/api/auth/logout/route")).POST;
    getMe = (await import("@/app/api/auth/me/route")).GET;
    getUserByToken = (await import("@/lib/auth")).getUserByToken;
  });

  afterEach(() => {
    teardown();
    vi.resetModules();
  });

  it("register → login → me → logout", async () => {
    const email = `auth-${Date.now()}@test.dev`;
    const reg = await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(1) },
        body: JSON.stringify({ email, password: PW, name: "Auth Test" }),
      }),
    );
    expect(reg.status).toBe(200);
    const { token, user } = await readJson<{ token: string; user: { email: string } }>(
      reg,
    );
    expect(user.email).toBe(email);
    expect(token.length).toBeGreaterThan(10);

    const me = await getMe(
      new Request("http://test/api/auth/me", { headers: bearer(token) }),
    );
    expect(me.status).toBe(200);

    const logout = await postLogout(
      new Request("http://test/api/auth/logout", {
        method: "POST",
        headers: { ...bearer(token), ...testIp(2) },
      }),
    );
    expect(logout.status).toBe(200);
    expect(await getUserByToken(token)).toBeNull();

    const login = await postLogin(
      new Request("http://test/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(3) },
        body: JSON.stringify({ email, password: PW }),
      }),
    );
    expect(login.status).toBe(200);
    const loginBody = await readJson<{ token: string }>(login);
    expect(loginBody.token).toBeTruthy();
  });

  it("rejects duplicate registration", async () => {
    const email = `dup-${Date.now()}@test.dev`;
    const body = JSON.stringify({ email, password: PW, name: "Dup" });
    const first = await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(10) },
        body,
      }),
    );
    expect(first.status).toBe(200);
    const second = await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(11) },
        body,
      }),
    );
    expect(second.status).toBe(400);
  });

  it("rejects wrong password", async () => {
    const email = `wrong-${Date.now()}@test.dev`;
    await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(20) },
        body: JSON.stringify({ email, password: PW, name: "Wrong PW" }),
      }),
    );
    const login = await postLogin(
      new Request("http://test/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(21) },
        body: JSON.stringify({ email, password: "notthepassword" }),
      }),
    );
    expect(login.status).toBe(401);
  });

  it("account deletion purges analytics and vitals rows", async () => {
    const email = `delete-${Date.now()}@test.dev`;
    const reg = await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(30) },
        body: JSON.stringify({ email, password: PW, name: "Delete Me" }),
      }),
    );
    const { token, user } = await readJson<{ token: string; user: { id: string } }>(reg);

    const now = Date.now();
    await db.insert(analyticsEvents).values({
      id: `evt-${now}`,
      name: "lesson_complete",
      props: "{}",
      pathname: "/lesson/x",
      userId: user.id,
      createdAt: now,
    });
    await db.insert(webVitals).values({
      id: `vit-${now}`,
      name: "LCP",
      value: 1.2,
      rating: "good",
      pathname: "/",
      userId: user.id,
      createdAt: now,
    });

    const delRoute = (await import("@/app/api/account/route")).DELETE;
    const del = await delRoute(
      new Request("http://test/api/account", {
        method: "DELETE",
        headers: { ...bearer(token), ...testIp(31) },
      }),
    );
    expect(del.status).toBe(200);

    expect(
      (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0],
    ).toBeUndefined();
    expect(
      (await db.select().from(analyticsEvents).where(eq(analyticsEvents.userId, user.id)))
        .length,
    ).toBe(0);
    expect(
      (await db.select().from(webVitals).where(eq(webVitals.userId, user.id))).length,
    ).toBe(0);
  });
});
