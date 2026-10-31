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
    const r = evaluateDepsGate(audit, {
      waivers: [{ id: 100, expires: "2099-01-01", approvedBy: "arc" }],
    });
    expect(r.pass).toBe(true);
    expect(r.unwaived).toHaveLength(0);
  });

  it("treats expired waivers as unwaived", () => {
    const audit = {
      metadata: { vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0, info: 0 } },
      advisories: {
        "1": { id: 100, severity: "critical", module_name: "pkg-a" },
      },
    };
    const r = evaluateDepsGate(
      audit,
      { waivers: [{ id: 100, expires: "2020-01-01", approvedBy: "arc" }] },
      new Date("2026-01-01"),
    );
    expect(r.pass).toBe(false);
    expect(r.unwaived).toHaveLength(1);
  });
});
