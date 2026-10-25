import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailDeliveryError, EmailNotConfiguredError } from "./errors";
import { sendEmail } from "./send";
import { passwordResetEmail, verifyEmailMessage } from "./templates";
import type { EmailMessage } from "./types";

const TOKEN = "reset-token-super-secret";
const LINK = `https://chess-school.in/account/reset#${TOKEN}`;
const FROM = "Chess School <noreply@example.com>";

const message: EmailMessage = {
  to: "ada@example.com",
  subject: "Hello from Chess School",
  text: `Open ${LINK} to continue.`,
  html: `<p><a href="${LINK}">Continue</a></p>`,
};

function useEnv(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    NODE_ENV: "test",
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("transport selection", () => {
  it("uses the console transport in development when no provider key is set", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    useEnv({ NODE_ENV: "development" });
    const result = await sendEmail(message);

    expect(result).toEqual({ provider: "console", id: null });
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = info.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toContain("a***@example.com");
    expect(logged).not.toContain("ada@example.com");
    expect(logged).toContain(LINK);
  });

  it("uses the console transport in test and in non-production CI", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    useEnv({ NODE_ENV: "test", CI: "true" });
    const testResult = await sendEmail(message);
    expect(testResult.provider).toBe("console");

    info.mockClear();
    useEnv({ NODE_ENV: "development", CI: "1", VERCEL_ENV: "preview" });
    const ciResult = await sendEmail(message);
    expect(ciResult.provider).toBe("console");
    const logged = info.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toContain(LINK);
    expect(logged).not.toContain("ada@example.com");
    expect(logged).toContain("a***@example.com");
  });

  it("masks the recipient in console logs and keeps the link in the text", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    useEnv({ NODE_ENV: "development" });

    await sendEmail({ ...message, to: "jane@example.com" });

    const logged = info.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toContain("j***@example.com");
    expect(logged).not.toContain("jane@example.com");
    expect(logged).toContain(LINK);
  });

  it("selects Resend only when provider, key, and from are all set", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "email_123" }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    useEnv({ RESEND_API_KEY: "re_test_key", EMAIL_FROM: FROM });
    await sendEmail(message);
    expect(fetchMock).not.toHaveBeenCalled();

    useEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "",
    });
    await sendEmail(message);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn.mock.calls.join(" ")).not.toContain("re_test_key");

    useEnv({
      NODE_ENV: "production",
      EMAIL_PROVIDER: "Resend",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: FROM,
    });
    const result = await sendEmail(message);
    expect(result).toEqual({ provider: "resend", id: "email_123" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("production fail-closed", () => {
  it("throws when production has no real provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    useEnv({ NODE_ENV: "production" });
    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailNotConfiguredError);
    await expect(sendEmail(message)).rejects.toThrow(/EMAIL_PROVIDER=resend/);
    useEnv({ NODE_ENV: "production", EMAIL_PROVIDER: "console" });
    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailNotConfiguredError);
    useEnv({ NODE_ENV: "production", EMAIL_PROVIDER: "postmark" });
    await expect(sendEmail(message)).rejects.toThrow(/not supported/);
    useEnv({
      NODE_ENV: "production",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
    });
    const incomplete = await sendEmail(message).catch((err: unknown) => err);
    expect(incomplete).toBeInstanceOf(EmailNotConfiguredError);
    expect(String(incomplete)).toMatch(/RESEND_API_KEY and EMAIL_FROM/);
    expect(String(incomplete)).not.toContain("re_test_key");
    expect(String(incomplete)).not.toContain(TOKEN);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();

    useEnv({ NODE_ENV: "production", CI: "1" });
    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailNotConfiguredError);
  });

  it("fails closed when VERCEL_ENV is unset and NODE_ENV is production", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    useEnv({ NODE_ENV: "production", VERCEL_ENV: "", CI: "1" });

    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("uses the console transport on a Vercel preview when NODE_ENV is production", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    useEnv({ NODE_ENV: "production", VERCEL_ENV: "preview", CI: "1" });

    const result = await sendEmail(message);
    expect(result).toEqual({ provider: "console", id: null });
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = info.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toContain("a***@example.com");
    expect(logged).not.toContain("ada@example.com");
    expect(logged).toContain(LINK);
  });

  it("fails closed on Vercel production when CI=1 and no provider key is set", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    useEnv({ VERCEL_ENV: "production", CI: "1", NODE_ENV: "production" });

    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("uses Resend on Vercel production when CI=1 and a provider key is set", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "email_vercel" }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    useEnv({
      VERCEL_ENV: "production",
      CI: "1",
      NODE_ENV: "production",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: FROM,
    });

    const result = await sendEmail(message);
    expect(result).toEqual({ provider: "resend", id: "email_vercel" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("Resend request", () => {
  it("POSTs the Resend emails payload and returns the id", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => Response.json({ id: "email_abc" }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const reset = passwordResetEmail({
      to: "ada@example.com",
      name: "Ada",
      link: LINK,
    });

    useEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: FROM,
    });
    const result = await sendEmail(reset);

    expect(result).toEqual({ provider: "resend", id: "email_abc" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      from: FROM,
      to: ["ada@example.com"],
      subject: reset.subject,
      text: reset.text,
      html: reset.html,
    });
  });

  it("fails on a non-OK response without leaking the API key", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ message: "Invalid API key re_test_key" }, { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    useEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: FROM,
    });
    const error = await sendEmail(message).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(String(error)).toContain("401");
    expect(String(error)).not.toContain("re_test_key");
    expect(String(error)).not.toContain(TOKEN);
  });

  it("turns a 10 second Resend timeout into EmailDeliveryError", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => {
        throw new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError",
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    useEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: FROM,
    });

    const error = await sendEmail(message).catch((err: unknown) => err);

    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(signal);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(String(error)).toMatch(/timed out/i);
    expect(String(error)).not.toContain("re_test_key");
  });
});

describe("templates", () => {
  it("includes the caller link in the password-reset and verify-email messages", () => {
    const verifyLink = "https://chess-school.in/account/verify#verify-token-value";
    const reset = passwordResetEmail({
      to: "ada@example.com",
      name: "Ada",
      link: LINK,
    });
    const verify = verifyEmailMessage({
      to: "ada@example.com",
      name: "Ada",
      link: verifyLink,
    });

    expect(reset.subject).toBe("Reset your Chess School password");
    expect(reset.text).toContain("Hi Ada,");
    expect(reset.text).toContain(LINK);
    expect(reset.html).toContain(`href="${LINK}"`);
    expect(reset.html).toContain(LINK);
    expect(reset.text).toContain("Chess School");
    expect(reset.html).toContain("Chess School");

    expect(verify.subject).toBe("Verify your Chess School email");
    expect(verify.text).toContain(verifyLink);
    expect(verify.html).toContain(`href="${verifyLink}"`);
    expect(verify.html).toContain("Chess School");
  });

  it("escapes HTML in names and in links", () => {
    const name = `Ann <script>alert("x")</script> & Co`;
    const link = `https://chess-school.in/reset#tok" onclick="alert(1)`;
    const reset = passwordResetEmail({ to: "ada@example.com", name, link });

    expect(reset.text).toContain(`Hi ${name},`);
    expect(reset.text).toContain(link);
    expect(reset.html).not.toContain("<script>");
    expect(reset.html).not.toContain(`onclick="alert`);
    expect(reset.html).toContain(
      "Ann &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co",
    );
    expect(reset.html).toContain(
      "https://chess-school.in/reset#tok&quot; onclick=&quot;alert(1)",
    );

    const blank = verifyEmailMessage({
      to: "ada@example.com",
      name: "   ",
      link: "https://chess-school.in/verify#t",
    });
    expect(blank.text.startsWith("Hi there,")).toBe(true);
    expect(blank.html).toContain("Hi there,");
  });

  it("rejects bad, relative, and non-https production links", () => {
    const input = { to: "ada@example.com", name: "Ada" };
    useEnv({ NODE_ENV: "test", VERCEL_ENV: "" });

    expect(() => passwordResetEmail({ ...input, link: "not a url" })).toThrow(
      /absolute URL/,
    );
    expect(() => passwordResetEmail({ ...input, link: "/account/reset#tok" })).toThrow(
      /absolute URL/,
    );
    expect(() => verifyEmailMessage({ ...input, link: "javascript:alert(1)" })).toThrow(
      /http or https/,
    );

    useEnv({ NODE_ENV: "test", VERCEL_ENV: "" });
    const local = passwordResetEmail({
      ...input,
      link: "http://localhost:3000/reset#tok",
    });
    expect(local.text).toContain("http://localhost:3000/reset#tok");

    useEnv({ NODE_ENV: "production", VERCEL_ENV: "", CI: "1" });
    expect(() =>
      passwordResetEmail({ ...input, link: "http://localhost:3000/reset#tok" }),
    ).toThrow(/https in production/);
    expect(() =>
      verifyEmailMessage({ ...input, link: "http://chess-school.in/verify#tok" }),
    ).toThrow(/https in production/);

    useEnv({ NODE_ENV: "test", VERCEL_ENV: "production", CI: "1" });
    expect(() =>
      passwordResetEmail({ ...input, link: "http://localhost/reset#tok" }),
    ).toThrow(/https in production/);

    useEnv({ NODE_ENV: "production", VERCEL_ENV: "preview", CI: "1" });
    const preview = passwordResetEmail({ ...input, link: LINK });
    expect(preview.text).toContain(LINK);

    useEnv({ NODE_ENV: "production", VERCEL_ENV: "production", CI: "1" });
    expect(() =>
      passwordResetEmail({ ...input, link: "http://chess-school.in/reset#tok" }),
    ).toThrow(/https in production/);
    const secure = passwordResetEmail({ ...input, link: LINK });
    expect(secure.text).toContain(LINK);
  });
});
