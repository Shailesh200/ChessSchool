import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { bootApiTestEnv, testIp, type TestDb } from "@/lib/test-db.harness";
import { passwordResetTokens, users } from "@/db/schema";
import { hashSessionToken } from "@/lib/session-token";

const PW = "testpass123";

describe("password reset token consume race (W-004 d)", () => {
  let teardown: () => void = () => {};
  let db: TestDb;
  let postRegister: typeof import("@/app/api/auth/register/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    ({ teardown, db } = await bootApiTestEnv());
    postRegister = (await import("@/app/api/auth/register/route")).POST;
  });

  afterEach(() => {
    teardown();
    vi.resetModules();
  });

  async function register(email: string) {
    const res = await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(1) },
        body: JSON.stringify({ email, password: PW, name: "Race Test" }),
      }),
    );
    expect(res.status).toBe(200);
  }

  it("allows exactly one success when two resets run in parallel on the same token", async () => {
    const email = `race-${Date.now()}@test.dev`;
    await register(email);
    const user = (
      await db.select().from(users).where(eq(users.email, email)).limit(1)
    )[0]!;
    const raw = "parallel-reset-token-value-32chars!!";
    const now = Date.now();
    await db.insert(passwordResetTokens).values({
      id: hashSessionToken(raw),
      userId: user.id,
      expiresAt: now + 45 * 60_000,
      usedAt: null,
      createdAt: now,
    });

    const { resetPasswordWithToken } = await import("@/lib/password-reset");
    const [a, b] = await Promise.all([
      resetPasswordWithToken(raw, "newpass1234"),
      resetPasswordWithToken(raw, "anotherpass1"),
    ]);
    const okCount = [a, b].filter((r) => "ok" in r && r.ok).length;
    expect(okCount).toBe(1);
  });
});
