import { describe, expect, it } from "vitest";
import { sanitizeAppNext } from "./auth-redirect";

describe("sanitizeAppNext", () => {
  it("defaults to academy", () => {
    expect(sanitizeAppNext(undefined)).toBe("/academy");
    expect(sanitizeAppNext(null)).toBe("/academy");
    expect(sanitizeAppNext("")).toBe("/academy");
  });

  it("allows in-app paths", () => {
    expect(sanitizeAppNext("/play")).toBe("/play");
    expect(sanitizeAppNext("/onboarding")).toBe("/onboarding");
  });

  it("rejects open redirects and auth loops", () => {
    expect(sanitizeAppNext("//evil.com")).toBe("/academy");
    expect(sanitizeAppNext("https://evil.com")).toBe("/academy");
    expect(sanitizeAppNext("/login")).toBe("/academy");
    expect(sanitizeAppNext("/register?next=/play")).toBe("/academy");
    expect(sanitizeAppNext("/welcome")).toBe("/academy");
  });

  it("honors custom fallback", () => {
    expect(sanitizeAppNext(undefined, "/onboarding")).toBe("/onboarding");
  });
});
