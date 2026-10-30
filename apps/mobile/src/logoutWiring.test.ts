import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// auth.tsx and app/account.tsx need React Native, so they are read as source (same approach
// as authWiring.test.ts). DP-M-006: logout is local first, the server revoke is background,
// and the Account button cannot be tapped twice.

const here = dirname(fileURLToPath(import.meta.url));
const auth = readFileSync(join(here, "auth.tsx"), "utf8");
const account = readFileSync(join(here, "..", "app", "account.tsx"), "utf8");

function logoutBody(): string {
  const at = auth.indexOf("const logout = ");
  expect(at).toBeGreaterThan(-1);
  const rest = auth.slice(at);
  return rest.slice(0, rest.search(/\n {2}const deleteAccount/));
}

describe("auth.tsx logout (DP-M-006)", () => {
  it("goes through logoutOnce with forgetUser + the shared wipe, and never awaits the server itself", () => {
    const body = logoutBody();
    expect(body).toContain("await logoutOnce(");
    expect(body).toContain("forgetUser()");
    expect(body).toContain("await wipeUserData()");
    expect(body).toContain("setNeedsRevalidate(false)");
    // no direct request: an awaited /api/auth/logout is the 45 s freeze this change removes
    expect(body).not.toMatch(/api\(\s*["'`]\/api\/auth\/logout/);
    expect(body).not.toContain("expired");
  });

  it("retries revokes that failed earlier at app start", () => {
    expect(auth).toMatch(/void flushPendingRevokes\(\)/);
  });
});

describe("Account > Log out button (DP-M-006)", () => {
  it("is disabled and shows busy while logging out, and a ref guards a double tap", () => {
    const button = account.match(/<Button label="Log out"[\s\S]*?\/>/)?.[0] ?? "";
    expect(button).toContain("disabled={loggingOut}");
    expect(button).toContain("loading={loggingOut}");
    expect(button).toContain("onLogout()");
    expect(account).toMatch(/if \(loggingOutRef\.current\) return;\s*loggingOutRef\.current = true;/);
    expect(account).toMatch(/finally \{\s*loggingOutRef\.current = false;\s*setLoggingOut\(false\);/);
  });
});
