import { describe, expect, it } from "vitest";
import { checkPasswordStrength, validateForgotEmail, passwordsMatch } from "./passwordResetValidation";

describe("validateForgotEmail", () => {
  it("accepts a normal address", () => {
    expect(validateForgotEmail("sam@example.com")).toEqual({ ok: true, email: "sam@example.com" });
  });

  it("rejects incomplete addresses like the design error state", () => {
    const r = validateForgotEmail("sam@example");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("@");
  });
});

describe("checkPasswordStrength", () => {
  it("marks knight-fork-42 as strong", () => {
    const c = checkPasswordStrength("knight-fork-42");
    expect(c.level).toBe(4);
    expect(c.label).toContain("Strong");
    expect(c.rules.length).toBe(true);
  });

  it("marks short passwords as too short", () => {
    const c = checkPasswordStrength("knight1");
    expect(c.rules.length).toBe(false);
    expect(c.label).toMatch(/Too short/i);
  });
});

describe("passwordsMatch", () => {
  it("detects mismatch", () => {
    expect(passwordsMatch("knight1", "knight2")).toBe(false);
    expect(passwordsMatch("knight-fork-42", "knight-fork-42")).toBe(true);
  });
});
