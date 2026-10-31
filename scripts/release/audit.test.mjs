import { describe, expect, it } from "vitest";
import { evaluateDepsGate, parseAuditReport } from "./lib/audit.mjs";

describe("audit.mjs", () => {
  it("counts critical and high from metadata", () => {
    const { counts } = parseAuditReport({
      advisories: {},
      metadata: { vulnerabilities: { critical: 2, high: 3, moderate: 0, low: 0, info: 0 } },
    });
    expect(counts.critical).toBe(2);
    expect(counts.high).toBe(3);
  });

  it("fails unwaived critical/high advisories", () => {
    const audit = {
      metadata: { vulnerabilities: { critical: 1, high: 1, moderate: 0, low: 0, info: 0 } },
      advisories: {
        "1": { id: 100, severity: "critical", module_name: "pkg-a" },
        "2": { id: 200, severity: "high", module_name: "pkg-b" },
      },
    };
    const r = evaluateDepsGate(audit, { waivers: [] });
    expect(r.pass).toBe(false);
    expect(r.unwaived).toHaveLength(2);
  });

  it("passes when critical/high are waived", () => {
    const audit = {
      metadata: { vulnerabilities: { critical: 1, high: 0, moderate: 5, low: 0, info: 0 } },
      advisories: {
        "1": { id: 100, severity: "critical", module_name: "pkg-a" },
        "2": { id: 201, severity: "moderate", module_name: "pkg-c" },
      },
    };
    const r = evaluateDepsGate(audit, { waivers: ["100"] });
    expect(r.pass).toBe(true);
    expect(r.unwaived).toHaveLength(0);
  });
});
