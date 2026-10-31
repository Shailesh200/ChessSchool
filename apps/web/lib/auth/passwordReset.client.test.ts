import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PASSWORD_FORGOT_API,
  PASSWORD_RESET_API,
  postPasswordForgot,
  postPasswordReset,
} from "./passwordReset.client";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/password-reset-messages";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("passwordReset.client", () => {
  it("postPasswordForgot calls POST /api/auth/password/forgot", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await postPasswordForgot("ada@example.com");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(PASSWORD_FORGOT_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" }),
    });
  });

  it("postPasswordReset calls POST /api/auth/password/reset", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postPasswordReset("tok123", "newpass1234");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(PASSWORD_RESET_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "tok123", password: "newpass1234" }),
    });
  });

  it("maps 429 to a friendly rate-limit message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "rate_limited" }, { status: 429 })),
    );
    const result = await postPasswordForgot("a@b.co");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error).toMatch(/Too many attempts/i);
    }
  });
});
