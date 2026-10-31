import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  bootApiTestEnv,
  readJson,
  testIp,
  type TestDb,
} from "@/lib/test-db.harness";
import { passwordResetTokens, sessions, users, oauthAccounts } from "@/db/schema";
import { hashSessionToken } from "@/lib/session-token";
import {
  createPasswordResetTestTransport,
  passwordResetTestOutbox,
  resetPasswordResetTestOutbox,
} from "@/lib/email/password-reset-test-transport";
import { setPasswordResetTransportForTests } from "@/lib/email/send-password-reset";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/password-reset-messages";

const PW = "testpass123";

describe("password reset API", () => {
  let teardown: () => void = () => {};
  let db: TestDb;
  let postForgot: typeof import("@/app/api/auth/forgot-password/route").POST;
  let postRegister: typeof import("@/app/api/auth/register/route").POST;
  let postLogin: typeof import("@/app/api/auth/login/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    resetPasswordResetTestOutbox();
    setPasswordResetTransportForTests(createPasswordResetTestTransport());
    ({ teardown, db } = await bootApiTestEnv());
    postForgot = (await import("@/app/api/auth/forgot-password/route")).POST;
    postRegister = (await import("@/app/api/auth/register/route")).POST;
    postLogin = (await import("@/app/api/auth/login/route")).POST;
  });

  afterEach(() => {
    setPasswordResetTransportForTests(undefined);
    resetPasswordResetTestOutbox();
    teardown();
    vi.resetModules();
  });

  async function register(email: string) {
    const res = await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(1) },
        body: JSON.stringify({ email, password: PW, name: "Reset Test" }),
      }),
    );
    expect(res.status).toBe(200);
    return readJson<{ token: string }>(res);
  }

  it("returns the same generic JSON for unknown and known emails", async () => {
    const unknown = await postForgot(
      new Request("http://test/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(2) },
        body: JSON.stringify({ email: "missing@example.com" }),
      }),
    );
    expect(unknown.status).toBe(200);
    expect(await readJson(unknown)).toEqual({
      ok: true,
      message: PASSWORD_RESET_GENERIC_MESSAGE,
    });

    const email = `known-${Date.now()}@test.dev`;
    await register(email);
    const known = await postForgot(
      new Request("http://test/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(3) },
        body: JSON.stringify({ email }),
      }),
    );
    expect(known.status).toBe(200);
    expect(await readJson(known)).toEqual({
      ok: true,
      message: PASSWORD_RESET_GENERIC_MESSAGE,
    });
    expect(passwordResetTestOutbox.length).toBe(1);
  });

  it("stores only a hash of the token, not the raw value", async () => {
    const email = `hash-${Date.now()}@test.dev`;
    await register(email);
    await postForgot(
      new Request("http://test/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(4) },
        body: JSON.stringify({ email }),
      }),
    );
    const mail = passwordResetTestOutbox[0]?.text ?? "";
    const match = mail.match(/token=([^&\s]+)/);
    expect(match).toBeTruthy();
    const raw = decodeURIComponent(match![1]!);
    const rows = await db.select().from(passwordResetTokens);
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(hashSessionToken(raw));
    expect(rows[0]!.id).not.toBe(raw);
    for (const row of rows) {
      expect(row.id).not.toContain(raw.slice(0, 8));
    }
  });

  it("invalidates older tokens when a new reset is requested", async () => {
    const email = `invalidate-${Date.now()}@test.dev`;
    await register(email);
    const body = JSON.stringify({ email });
    const req = () =>
      new Request("http://test/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(5) },
        body,
      });
    await postForgot(req());
    const firstRows = await db.select().from(passwordResetTokens);
    expect(firstRows.length).toBe(1);
    await postForgot(req());
    const secondRows = await db.select().from(passwordResetTokens);
    expect(secondRows.length).toBe(1);
    expect(secondRows[0]!.id).not.toBe(firstRows[0]!.id);
  });

  it("marks tokens used and rejects reuse", async () => {
    const email = `single-${Date.now()}@test.dev`;
    await register(email);
    await postForgot(
      new Request("http://test/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(6) },
        body: JSON.stringify({ email }),
      }),
    );
    const mail = passwordResetTestOutbox[0]?.text ?? "";
    const raw = decodeURIComponent(mail.match(/token=([^&\s]+)/)![1]!);
    const { resetPasswordWithToken } = await import("@/lib/password-reset");
    expect(await resetPasswordWithToken(raw, "newpass1234")).toEqual({ ok: true });
    expect(await resetPasswordWithToken(raw, "anotherpass1")).toMatchObject({
      error: expect.stringMatching(/invalid or has expired/i),
    });
    const row = (await db.select().from(passwordResetTokens))[0];
    expect(row?.usedAt).not.toBeNull();
  });

  it("rejects expired tokens", async () => {
    const email = `expired-${Date.now()}@test.dev`;
    const reg = await register(email);
    const user = (
      await db.select().from(users).where(eq(users.email, email)).limit(1)
    )[0];
    const raw = "test-expired-token-value-32chars!!";
    await db.insert(passwordResetTokens).values({
      id: hashSessionToken(raw),
      userId: user!.id,
      expiresAt: Date.now() - 1000,
      usedAt: null,
      createdAt: Date.now() - 60_000,
    });
    const { resetPasswordWithToken } = await import("@/lib/password-reset");
    expect(await resetPasswordWithToken(raw, "newpass1234")).toMatchObject({
      error: expect.stringMatching(/invalid or has expired/i),
    });
    void reg;
  });

  it("revokes existing sessions after a successful reset", async () => {
    const email = `sessions-${Date.now()}@test.dev`;
    const { token } = await register(email);
    const login = await postLogin(
      new Request("http://test/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(7) },
        body: JSON.stringify({ email, password: PW }),
      }),
    );
    expect(login.status).toBe(200);
    void token;

    await postForgot(
      new Request("http://test/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(8) },
        body: JSON.stringify({ email }),
      }),
    );
    const raw = decodeURIComponent(
      passwordResetTestOutbox[0]!.text.match(/token=([^&\s]+)/)![1]!,
    );
    const before = await db.select().from(sessions);
    expect(before.length).toBeGreaterThan(0);
    const { resetPasswordWithToken } = await import("@/lib/password-reset");
    await resetPasswordWithToken(raw, "brandnewpass1");
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("does not email Google-only accounts but still returns generic JSON", async () => {
    const email = `google-${Date.now()}@test.dev`;
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.insert(users).values({
      id,
      email,
      passwordHash: null,
      name: "Google Only",
      role: "student",
      createdAt: now,
    });
    await db.insert(oauthAccounts).values({
      provider: "google",
      providerAccountId: "sub-123",
      userId: id,
      createdAt: now,
    });

    const res = await postForgot(
      new Request("http://test/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(9) },
        body: JSON.stringify({ email }),
      }),
    );
    expect(res.status).toBe(200);
    expect(passwordResetTestOutbox.length).toBe(0);
    expect(await db.select().from(passwordResetTokens)).toHaveLength(0);
  });
});
