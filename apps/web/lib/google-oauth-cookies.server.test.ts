import { describe, expect, it } from "vitest";
import { sanitizeOAuthNext } from "./google-oauth-cookies.server";

const FALLBACK = "/welcome";

const BASES = [
  "https://chess-school.in/api/auth/google/callback",
  "http://localhost:3000/api/auth/google/callback",
  "https://preview.chess-school.in/api/auth/google/callback",
];

/** Previous check: leading `/`, but not `//`, `/login`, or `/register`. */
function passedLegacyCheck(next: string): boolean {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return false;
  if (next.startsWith("/login") || next.startsWith("/register")) return false;
  return true;
}

function escapesAnywhere(value: string): boolean {
  return BASES.some((base) => {
    try {
      return new URL(value, base).origin !== new URL(base).origin;
    } catch {
      return true;
    }
  });
}

function expectStaysOnApp(value: string) {
  expect(value.startsWith("/")).toBe(true);
  expect(value.startsWith("//")).toBe(false);
  expect(escapesAnywhere(value)).toBe(false);
}

function queryNext(raw: string): string {
  const url = new URL(`https://chess-school.in/api/auth/google?next=${raw}`);
  return url.searchParams.get("next") ?? "";
}

describe("sanitizeOAuthNext", () => {
  it("keeps same-origin in-app paths unchanged", () => {
    const allowed = [
      "/",
      "/welcome",
      "/play",
      "/academy",
      "/onboarding",
      "/placement",
      "/account",
      "/lesson/pre-board-intro",
      "/class/1",
      "/play/online/game-1",
      "/play/arena",
      "/play?x=1&y=2",
      "/lesson/abc?x=1#h",
      "/play%20room",
      "/Login",
      "/play/../admin",
      "/./play",
      "/javascript:alert(1)",
      "/play?next=https://evil.example",
      "/play#//evil.example",
    ];

    for (const path of allowed) {
      expect(sanitizeOAuthNext(path)).toBe(path);
      expectStaysOnApp(path);
    }
  });

  it("falls back when next is missing or too long", () => {
    expect(sanitizeOAuthNext(undefined)).toBe(FALLBACK);
    expect(sanitizeOAuthNext(null)).toBe(FALLBACK);
    expect(sanitizeOAuthNext("")).toBe(FALLBACK);

    const max = `/${"a".repeat(2047)}`;
    expect(max).toHaveLength(2048);
    expect(sanitizeOAuthNext(max)).toBe(max);

    const tooLong = `/${"a".repeat(2048)}`;
    expect(tooLong).toHaveLength(2049);
    expect(sanitizeOAuthNext(tooLong)).toBe(FALLBACK);
    expect(sanitizeOAuthNext(`/${"a".repeat(10_000)}`)).toBe(FALLBACK);
  });

  it("keeps the /login and /register fallback, including disguised forms", () => {
    const authLoops = [
      "/login",
      "/login?next=/play",
      "/login/forgot",
      "/login-help",
      "/register",
      "/register?next=/play",
      "/register-now",
      "/./login",
      "/./register",
      "/play/../login",
      "/play/../register?x=1",
      "/foo/%2e%2e/login",
      "/%6Cogin",
      "/%6Cogin?next=/play",
      "/%72egister",
    ];

    for (const path of authLoops) {
      expect(sanitizeOAuthNext(path)).toBe(FALLBACK);
    }

    // Prefix match, same as before: `/login-help` falls back, `/registration` does not
    // (`registration` does not start with `register`).
    expect(sanitizeOAuthNext("/registration")).toBe("/registration");
    expect(sanitizeOAuthNext("/playground")).toBe("/playground");
    expect(sanitizeOAuthNext("/log")).toBe("/log");
    expect(sanitizeOAuthNext("/reg")).toBe("/reg");
  });

  describe("open redirects the old leading-// check missed", () => {
    const bypasses = [
      { label: "backslash host", payload: "/\\evil.example" },
      { label: "extra backslashes", payload: "/\\\\evil.example" },
      { label: "backslash then slash", payload: "/\\/evil.example" },
      { label: "backslash slash mix", payload: "/\\/\\/evil.example" },
      { label: "backslash-t host", payload: "/\\tevil.example" },
      {
        label: "backslash with userinfo",
        payload: "/\\evil.example\\@chess-school.in",
      },
      { label: "tab stripped into //", payload: "/\t/evil.example" },
      { label: "newline stripped into //", payload: "/\n/evil.example" },
      { label: "crlf stripped into //", payload: "/\r\n/evil.example" },
      { label: "tab then backslash host", payload: "/\t\\evil.example" },
      { label: "backslash our host off preview", payload: "/\\chess-school.in/play" },
      // These resolve to the sentinel origin, so an origin check alone would pass.
      { label: "backslash sentinel host", payload: "/\\oauth-next.invalid/play" },
      { label: "tab stripped into sentinel host", payload: "/\t/oauth-next.invalid" },
    ];

    it.each(bypasses)("blocks $label", ({ payload }) => {
      expect(passedLegacyCheck(payload)).toBe(true);
      expect(escapesAnywhere(payload)).toBe(true);
      const safe = sanitizeOAuthNext(payload);
      expect(safe).toBe(FALLBACK);
      expectStaysOnApp(safe);
    });

    it("blocks backslash and control encodings after searchParams decodes them", () => {
      const decoded = [
        queryNext("/%5Cevil.example"),
        queryNext("/%5c%5cevil.example"),
        queryNext("/%5C%2Fevil.example"),
        queryNext("/%09/evil.example"),
        queryNext("/%0a/evil.example"),
        queryNext("/%0d%0a/evil.example"),
        queryNext("/%5Cevil.example%2F%40chess"),
      ];

      expect(decoded[0]).toBe("/\\evil.example");
      expect(decoded[3]).toBe("/\t/evil.example");

      for (const payload of decoded) {
        expect(passedLegacyCheck(payload)).toBe(true);
        expect(escapesAnywhere(payload)).toBe(true);
        expect(sanitizeOAuthNext(payload)).toBe(FALLBACK);
      }
    });
  });

  describe("payloads that must still fall back", () => {
    const rejected = [
      "//evil.example",
      "///evil.example",
      "////evil.example",
      "\\\\evil.example",
      "https://evil.example",
      "https://evil.example/path",
      "http://evil.example",
      "http://127.0.0.1",
      "//127.0.0.1",
      "https://chess-school.in.evil.example",
      "https://chess-school.in@evil.example",
      "https://chess-school.in/play",
      "//chess-school.in/play",
      "https:\\\\evil.example",
      "javascript:alert(1)",
      "javascript://evil.example",
      "data:text/html,hi",
      "mailto:a@evil.example",
      "play",
      "../play",
      " /play",
      "/play ",
      "/play\t",
      "\t//evil.example",
      "\n//evil.example",
      "/\0/evil.example",
      "/play\0",
      "/%00/evil.example",
      "/%",
      "/%ZZ",
      "/%2",
      "//oauth-next.invalid/play",
      "https://oauth-next.invalid/play",
      "/..//evil.example",
      "/%2e%2e//evil.example",
      "/play\\../\\evil.example",
      "/play\r\nLocation: https://evil.example",
      `//${"a".repeat(2000)}`,
    ];

    it.each(rejected)("rejects %j", (payload) => {
      const safe = sanitizeOAuthNext(payload);
      expect(safe).toBe(FALLBACK);
      expectStaysOnApp(safe);
    });

    it("rejects encoded slashes and backslashes that new URL does not treat as a host", () => {
      // Still encoded when they reach the sanitizer (cookie, or a second `%25`).
      // `new URL` keeps them on-origin; decoding again yields `//` or `\`.
      const encoded = [
        "/%2Fevil.example",
        "/%2fevil.example",
        "/%2F/evil.example",
        "/%2F%2Fevil.example",
        "/%5Cevil.example",
        "/%5cevil.example",
        "/%5C%5Cevil.example",
        "/%09/evil.example",
        "/%0A/evil.example",
        "/%0D/evil.example",
        "/%252F%252Fevil.example",
        queryNext("%2f%2fevil.example"),
        queryNext("%252F%252Fevil.example"),
        queryNext("/%252F%252Fevil.example"),
        queryNext("/%25252F%25252Fevil.example"),
      ];

      expect(queryNext("/%2Fevil.example")).toBe("//evil.example");
      expect(queryNext("%2F%2Fevil.example")).toBe("//evil.example");
      expect(queryNext("%2Fevil.example")).toBe("/evil.example");
      expect(escapesAnywhere("//evil.example")).toBe(true);
      expect(escapesAnywhere("/%2Fevil.example")).toBe(false);
      expect(escapesAnywhere("/%5Cevil.example")).toBe(false);

      for (const payload of encoded) {
        expect(sanitizeOAuthNext(payload)).toBe(FALLBACK);
      }
    });
  });

  it("never returns a value that leaves the app origin", () => {
    const controls = [
      ...Array.from({ length: 32 }, (_, code) => String.fromCharCode(code)),
      String.fromCharCode(127),
    ];
    const payloads = [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/%2Fevil.example",
      "/%5Cevil.example",
      "/..//evil.example",
      "/play?next=https://evil.example",
      "/play#//evil.example",
      "\u2215evil.example",
      "/\u2215evil.example",
      "/\uFF0Fevil.example",
      "/\uFF3Cevil.example",
      `/${"a".repeat(5000)}`,
    ];

    for (const control of controls) {
      payloads.push(
        `/${control}/evil.example`,
        `/${control}${control}evil.example`,
        `/evil.example${control}`,
        `/${control}\\evil.example`,
        `${control}//evil.example`,
      );
    }

    for (const payload of payloads) {
      const safe = sanitizeOAuthNext(payload);
      expectStaysOnApp(safe);
      if (passedLegacyCheck(payload) && escapesAnywhere(payload)) {
        expect(safe).toBe(FALLBACK);
      }
    }
  });
});
