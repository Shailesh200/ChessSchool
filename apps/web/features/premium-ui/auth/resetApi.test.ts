import { describe, expect, it, vi, afterEach } from "vitest";
import {
  ACCOUNT_RESET_PATH,
  postPasswordForgot,
  postPasswordReset,
  readResetTokenFromSearch,
} from "./resetApi";

describe("resetApi (Luffy contract)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the account reset page path for email links", () => {
    expect(ACCOUNT_RESET_PATH).toBe("/account/reset");
    expect(readResetTokenFromSearch("?token=abc")).toBe("abc");
  });

  it("postPasswordForgot handles 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, message: "Check your email." }),
      }),
    );
    const res = await postPasswordForgot("sam@example.com");
    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/password/forgot",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("postPasswordForgot handles 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid email" }),
      }),
    );
    const res = await postPasswordForgot("bad");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid");
  });

  it("postPasswordForgot handles 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );
    const res = await postPasswordForgot("sam@example.com");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("rate_limited");
      expect(res.message).toMatch(/wait a bit/i);
    }
  });

  it("postPasswordReset handles 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }),
    );
    const res = await postPasswordReset("tok", "Knight-pass1");
    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/password/reset",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "tok", password: "Knight-pass1" }),
      }),
    );
  });

  it("postPasswordReset handles 400 invalid link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "This reset link is invalid or has expired." }),
      }),
    );
    const res = await postPasswordReset("bad", "Knight-pass1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_link");
  });

  it("postPasswordReset handles 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );
    const res = await postPasswordReset("tok", "Knight-pass1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("rate_limited");
  });

  it("postPasswordReset rejects passwords under 8 characters client-side", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await postPasswordReset("tok", "short");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("weak_password");
    expect(fetch).not.toHaveBeenCalled();
  });
});
