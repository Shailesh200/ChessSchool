import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// auth.tsx needs React and expo, so it cannot run in this environment. This reads the
// source: the account-switch and expiry policy of progressStore only works if every
// sign-in path starts its session with the user id, before it syncs progress, and the
// 401 handler expires the session (it must not clear, which would start a new generation).

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "auth.tsx"),
  "utf8",
);

/** From `start` to the next `const … = ` at the provider's indent (or `end` if given). */
function from(start: string, end?: string): string {
  const at = src.indexOf(start);
  expect(at, `"${start}" not found in auth.tsx`).toBeGreaterThan(-1);
  const rest = src.slice(at + start.length);
  const stop = end ? rest.indexOf(end) : rest.search(/\n {2}const /);
  expect(stop, `end of "${start}" not found`).toBeGreaterThan(-1);
  return rest.slice(0, stop);
}

describe("auth.tsx wiring of progressStore", () => {
  it("calls beginSession(user.id) on all five sign-in paths", () => {
    expect(src.match(/progressStore\.beginSession\(user\.id\)/g)).toHaveLength(5);
  });

  for (const [name, text, next] of [
    [
      "session restore (/api/auth/me)",
      from('api<{ user: User }>("/api/auth/me")', "applyOnboardingGate"),
      "fetchProgress(",
    ],
    ["adoptSessionToken", from("const adoptSessionToken = "), "afterAuth("],
    ["login", from("const login = "), "afterAuth("],
    ["loginWithGoogle", from("const loginWithGoogle = "), "afterAuth("],
    ["register", from("const register = "), "syncProgressAfterAuth("],
  ] as const) {
    it(`${name}: beginSession(user.id) runs before ${next}`, () => {
      const begin = text.indexOf("progressStore.beginSession(user.id)");
      expect(begin, `${name} does not call beginSession`).toBeGreaterThan(-1);
      expect(text.indexOf(next)).toBeGreaterThan(begin);
    });
  }

  it("the 401 handler calls expire() and not clear()", () => {
    const handler = from(
      "setUnauthorizedHandler(() => {",
      "return () => setUnauthorizedHandler(null)",
    );
    expect(handler).toContain("progressStore.expire()");
    expect(handler).not.toContain("progressStore.clear()");
  });

  it("clear() is only called from logout and deleteAccount", () => {
    expect(src.match(/progressStore\.clear\(\)/g)).toHaveLength(2);
    expect(from("const logout = ")).toContain("progressStore.clear()");
    expect(from("const deleteAccount = ")).toContain("progressStore.clear()");
  });
});
