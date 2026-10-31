import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootApiTestEnv,
  testIp,
} from "@/lib/test-db.harness";
import {
  createPasswordResetTestTransport,
  passwordResetTestOutbox,
  resetPasswordResetTestOutbox,
} from "@/lib/email/password-reset-test-transport";
import { setPasswordResetTransportForTests } from "@/lib/email/send-password-reset";
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

describe("password reset forgot timing (W-004 f)", () => {
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

  it("returns the generic response before the deferred email send finishes", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://chess-school.in");
    let releaseSend!: () => void;
    const sendBlocked = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    setPasswordResetTransportForTests({
      name: "console",
      async send(message) {
        await sendBlocked;
        passwordResetTestOutbox.push(message);
        return { id: "test" };
      },
    });

    const email = `timing-${Date.now()}@test.dev`;
    await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(5) },
        body: JSON.stringify({ email, password: PW, name: "Timing Test" }),
      }),
    );

    const res = await postForgot(
      new Request("http://test/api/auth/password/forgot", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(6) },
        body: JSON.stringify({ email }),
      }),
    );
    expect(res.status).toBe(200);
    expect(passwordResetTestOutbox.length).toBe(0);

    releaseSend();
    await flushForgotPasswordAfterQueue();
    expect(passwordResetTestOutbox.length).toBe(1);
  });
});
