import { describe, expect, it, vi, afterEach } from "vitest";
import {
  PASSWORD_RESET_PAGE_PATH,
  completePasswordReset,
  readResetTokenFromLocation,
  requestPasswordReset,
  validatePasswordResetToken,
} from "./passwordReset.client";

describe("passwordReset.client (luffy-backend paths)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes the email link route used by luffy resetLink()", () => {
    expect(PASSWORD_RESET_PAGE_PATH).toBe("/account/reset");
  });

  it("rejects incomplete emails before calling the API", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const res = await requestPasswordReset("sam@example");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_email");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs forgot requests to /api/auth/forgot-password", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    );
    const res = await requestPasswordReset("sam@example.com");
    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "sam@example.com" }),
      }),
    );
  });

  it("reads reset tokens from hash fragment like frenkie email logs", () => {
    expect(readResetTokenFromLocation("", "#reset-token-super-secret")).toBe(
      "reset-token-super-secret",
    );
    expect(readResetTokenFromLocation("?token=abc", "")).toBe("abc");
  });

  it("does not call GET validate — token presence is enough", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await validatePasswordResetToken("tok");
    expect(res.status).toBe("valid");
    expect(fetch).not.toHaveBeenCalled();
    expect(await validatePasswordResetToken("")).toEqual({ status: "invalid" });
  });

  it("POSTs completed resets to /api/auth/reset-password", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    );
    const res = await completePasswordReset("tok", "Knight-fork-42");
    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "tok", password: "Knight-fork-42" }),
      }),
    );
  });

  it("maps luffy expired errors on 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "This reset link is invalid or has expired." }),
      }),
    );
    const res = await completePasswordReset("bad", "Knight-fork-42");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("expired");
  });
});
