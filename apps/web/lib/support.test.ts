import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL } from "./support";

describe("SUPPORT_EMAIL", () => {
  it("is the public chess-school.in inbox", () => {
    expect(SUPPORT_EMAIL).toBe("support@chess-school.in");
  });
});
