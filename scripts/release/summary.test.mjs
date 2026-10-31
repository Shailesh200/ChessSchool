import { describe, expect, it } from "vitest";
import { assertValidStatus, summarizeGateResults } from "./lib/summary.mjs";

describe("summary.mjs", () => {
  it("exit 1 when any check FAILs", () => {
    const s = summarizeGateResults({
      "deps-gate": { status: "FAIL" },
      "secrets-scan": { status: "PASS" },
    });
    expect(s.exitCode).toBe(1);
  });

  it("exit 0 when all PASS", () => {
    const s = summarizeGateResults({
      a: { status: "PASS" },
      b: { status: "SKIPPED" },
    });
    expect(s.exitCode).toBe(0);
    expect(s.checks.b.status).toBe("SKIPPED");
  });

  it("SKIPPED is never PASS", () => {
    expect(() => assertValidStatus("SKIPPED")).not.toThrow();
    expect(() => assertValidStatus("PASS")).not.toThrow();
  });
});
