import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootApiTestEnv,
  readJson,
  testIp,
} from "@/lib/test-db.harness";
import {
  createPasswordResetTestTransport,
  passwordResetTestOutbox,
  resetPasswordResetTestOutbox,
} from "@/lib/email/password-reset-test-transport";
import { setPasswordResetTransportForTests } from "@/lib/email/send-password-reset";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/password-reset-messages";
import {
  flushForgotPasswordAfterQueue,
  forgotPasswordAfterQueue,
} from "@/lib/password-reset-forgot-after.test-support";

const PW = "testpass123";

vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return {
    ...mod,
    after(task: () => void | Promise<void>) {
      forgotPasswordAfterQueue.push(task);
    },
  };
});

describe("password reset link origin (W-004 e)", () => {
  let teardown: () => void = () => {};
  let postForgot: typeof import("@/app/api/auth/password/forgot/route").POST;
  let postRegister: typeof import("@/app/api/auth/register/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    forgotPasswordAfterQueue.length = 0;
    resetPasswordResetTestOutbox();
    setPasswordResetTransportForTests(createPasswordResetTestTransport());
    ({ teardown } = await bootApiTestEnv());
    postForgot = (await import("@/app/api/auth/password/forgot/route")).POST;
    postRegister = (await import("@/app/api/auth/register/route")).POST;
  });

  afterEach(async () => {
    await flushForgotPasswordAfterQueue();
    setPasswordResetTransportForTests(undefined);
    resetPasswordResetTestOutbox();
    teardown();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function register(email: string) {
    const res = await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(2) },
        body: JSON.stringify({ email, password: PW, name: "Origin Test" }),
      }),
    );
    expect(res.status).toBe(200);
  }

  it("builds reset links from NEXT_PUBLIC_APP_URL, not a spoofed request Host", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://chess-school.in");
    const email = `origin-${Date.now()}@test.dev`;
    await register(email);
    const res = await postForgot(
      new Request("https://evil.example/api/auth/password/forgot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "evil.example",
          ...testIp(3),
        },
        body: JSON.stringify({ email }),
      }),
    );
    expect(res.status).toBe(200);
    await flushForgotPasswordAfterQueue();
    const text = passwordResetTestOutbox[0]?.text ?? "";
    expect(text).toContain("https://chess-school.in/account/reset?token=");
    expect(text).not.toContain("evil.example");
  });

  it("sends no email in production when NEXT_PUBLIC_APP_URL is unset", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const email = `prod-${Date.now()}@test.dev`;
    await register(email);
    const res = await postForgot(
      new Request("http://test/api/auth/password/forgot", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(4) },
        body: JSON.stringify({ email }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      ok: true,
      message: PASSWORD_RESET_GENERIC_MESSAGE,
    });
    await flushForgotPasswordAfterQueue();
    expect(passwordResetTestOutbox.length).toBe(0);
  });
});
