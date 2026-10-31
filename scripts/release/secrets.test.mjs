import { describe, expect, it } from "vitest";
import {
  formatFinding,
  isDisallowedEnvFile,
  scanFileContent,
  secretRuleNamesMatchingLine,
} from "./lib/secrets.mjs";

describe("secrets.mjs", () => {
  it("flags fake private key material without echoing the value in formatted output", () => {
    const secret = "-----BEGIN PRIVATE KEY-----\nMIIE";
    const names = secretRuleNamesMatchingLine(secret);
    expect(names).toContain("private-key");
    const findings = scanFileContent({
      path: "fixture.txt",
      lines: ["ok", secret],
    });
    const line = formatFinding(findings[0].path, findings[0].line, findings[0].rule);
    expect(line).toBe("fixture.txt:2: private-key");
    expect(line).not.toContain("MIIE");
  });

  it("allows .env.example but not other tracked .env files", () => {
    expect(isDisallowedEnvFile(".env.example")).toBe(false);
    expect(isDisallowedEnvFile("apps/web/.env")).toBe(true);
  });

  it("detects DATABASE_AUTH_TOKEN assignments", () => {
    const names = secretRuleNamesMatchingLine(
      "DATABASE_AUTH_TOKEN=abcdefghijklmnopqrst",
    );
    expect(names).toContain("database-auth-token");
  });
});
