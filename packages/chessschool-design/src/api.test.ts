import { describe, expect, it } from "vitest";
import { ApiError, isGuestClassLimit } from "./api";

describe("guest class limit", () => {
  it("matches only a 403 with code GUEST_CLASS_LIMIT", () => {
    expect(isGuestClassLimit(new ApiError(403, "GUEST_CLASS_LIMIT"))).toBe(true);
    expect(isGuestClassLimit(new ApiError(403, "not_found"))).toBe(false);
    expect(isGuestClassLimit(new ApiError(401, "unauthorized"))).toBe(false);
    expect(isGuestClassLimit(new Error("GUEST_CLASS_LIMIT"))).toBe(false);
  });
});
