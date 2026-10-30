import { describe, expect, it, vi, afterEach } from "vitest";
import {
  completePasswordReset,
  readResetTokenFromLocation,
  requestPasswordReset,
  validatePasswordResetToken,
} from "./passwordReset.client";

describe("passwordReset.client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects incomplete emails before calling the API", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const res = await requestPasswordReset("sam@example");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_email");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs forgot requests to the planned endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    const res = await requestPasswordReset("sam@example.com");
    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/password/forgot",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "sam@example.com" }),
      }),
    );
  });

  it("reads reset tokens from query or hash fragment", () => {
    expect(readResetTokenFromLocation("?token=abc", "")).toBe("abc");
    expect(readResetTokenFromLocation("", "#reset-token-super-secret")).toBe(
      "reset-token-super-secret",
    );
  });

  it("validates tokens via GET on the planned endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 410, json: async () => ({ code: "expired" }) }),
    );
    const res = await validatePasswordResetToken("tok");
    expect(res.status).toBe("expired");
    expect(fetch).toHaveBeenCalledWith("/api/auth/password/reset?token=tok", { method: "GET" });
  });

  it("POSTs completed resets to the planned endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    const res = await completePasswordReset("tok", "knight-fork-42");
    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/password/reset",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "tok", password: "knight-fork-42" }),
      }),
    );
  });
});
