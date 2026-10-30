import { describe, expect, it } from "vitest";
import { ACCOUNT_RESET_PATH, accountResetLink } from "./password-reset-path";

describe("accountResetLink", () => {
  it("uses /account/reset?token= with encoding", () => {
    expect(accountResetLink("https://example.test", "ab+c/d")).toBe(
      "https://example.test/account/reset?token=ab%2Bc%2Fd",
    );
  });

  it("exports the path constant for UI routes", () => {
    expect(ACCOUNT_RESET_PATH).toBe("/account/reset");
  });
});
