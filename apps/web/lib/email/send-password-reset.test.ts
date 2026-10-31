import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPasswordResetTestTransport,
  passwordResetTestOutbox,
  resetPasswordResetTestOutbox,
} from "./password-reset-test-transport";
import {
  sendPasswordResetEmail,
  setPasswordResetTransportForTests,
} from "./send-password-reset";

const LINK = "https://example.test/account/reset?token=raw-secret-token-value";
const FROM = "Chess School <noreply@example.com>";

function useEnv(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    NODE_ENV: "test",
    VERCEL: "",
    VERCEL_ENV: "",
    CI: "",
    EMAIL_PROVIDER: "",
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.unstubAllEnvs();
  setPasswordResetTransportForTests(undefined);
  resetPasswordResetTestOutbox();
});

describe("sendPasswordResetEmail fail-closed", () => {
  it("uses the in-memory test transport in Vitest", async () => {
    useEnv({ NODE_ENV: "test" });
    setPasswordResetTransportForTests(createPasswordResetTestTransport());
    const ok = await sendPasswordResetEmail(
      { to: "ada@example.com", name: "Ada", link: LINK },
      process.env,
    );
    expect(ok).toBe(true);
    expect(passwordResetTestOutbox[0]?.text).toContain(LINK);
  });

  it("refuses console transport on Vercel when Resend is not configured", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    useEnv({ VERCEL: "1", NODE_ENV: "production", VERCEL_ENV: "preview" });
    setPasswordResetTransportForTests(undefined);
    const ok = await sendPasswordResetEmail(
      { to: "ada@example.com", name: "Ada", link: LINK },
      process.env,
    );
    expect(ok).toBe(false);
    expect(info).not.toHaveBeenCalled();
    const logged = info.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain("raw-secret-token-value");
  });

  it("does not log the token when Resend is missing on Vercel production", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useEnv({
      VERCEL: "1",
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "",
      EMAIL_FROM: FROM,
    });
    setPasswordResetTransportForTests(undefined);
    const ok = await sendPasswordResetEmail(
      { to: "ada@example.com", name: "Ada", link: LINK },
      process.env,
    );
    expect(ok).toBe(false);
    const combined = [...info.mock.calls, ...warn.mock.calls].map((c) => c.join(" ")).join("\n");
    expect(combined).not.toContain("raw-secret-token-value");
  });

  it("sends via Resend on Vercel when fully configured", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "ok" }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    useEnv({
      VERCEL: "1",
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: FROM,
    });
    setPasswordResetTransportForTests(undefined);
    const ok = await sendPasswordResetEmail(
      { to: "ada@example.com", name: "Ada", link: LINK },
      process.env,
    );
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
