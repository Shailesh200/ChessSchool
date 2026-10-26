import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertLocalDatabaseUrl, assertSafeCaptureHost } from "./capture-host.mjs";

describe("assertSafeCaptureHost", () => {
  it("allows localhost, loopback, the emulator alias, and a branch preview", () => {
    assert.doesNotThrow(() => assertSafeCaptureHost("http://localhost:3000"));
    assert.doesNotThrow(() => assertSafeCaptureHost("http://127.0.0.1:3000"));
    assert.doesNotThrow(() => assertSafeCaptureHost("http://10.0.2.2:3000"));
    assert.doesNotThrow(() => assertSafeCaptureHost("http://10.0.2.2"));
    assert.doesNotThrow(() =>
      assertSafeCaptureHost("https://chess-school-git-lane-f-f12-shailesh200.vercel.app"),
    );
  });

  it("allows 10.0.2.2 only as an exact host", () => {
    assert.doesNotThrow(() => assertSafeCaptureHost("http://10.0.2.2:3210"));
    const refused = [
      "http://10.0.2.3",
      "http://10.0.0.1",
      "http://10.1.2.3",
      "http://10.255.255.255",
      "http://10.0.2.2.evil.com",
    ];
    for (const url of refused) {
      const host = new URL(url).hostname;
      assert.throws(
        () => assertSafeCaptureHost(url),
        new RegExp(`Refusing to register a capture user on ${host.replaceAll(".", "\\.")}`),
        url,
      );
    }
  });

  it("refuses production, main, staging, and lookalike hosts", () => {
    const refused = [
      "https://chess-school-git-main.vercel.app",
      "https://chess-school-git-main-shailesh200.vercel.app",
      "https://chess-school-git-staging.vercel.app",
      "https://chess-school-git-staging-x.vercel.app",
      "https://evil-git-x.vercel.app",
      "https://chess-school.vercel.app",
      "https://chess-school.in",
      "https://chess-school-git-x.vercel.app.evil.com",
    ];
    for (const url of refused) {
      const host = new URL(url).hostname;
      assert.throws(
        () => assertSafeCaptureHost(url),
        new RegExp(`Refusing to register a capture user on ${host.replaceAll(".", "\\.")}`),
        url,
      );
    }
  });
});

describe("assertLocalDatabaseUrl", () => {
  it("allows a local sqlite file, memory, and an exact local host", () => {
    for (const url of [
      undefined,
      "",
      "   ",
      "file:local.db",
      "file:/tmp/local.db",
      ":memory:",
      "localhost",
      "http://localhost:8080",
      "https://localhost:8080",
      "http://127.0.0.1:8080",
    ]) {
      assert.doesNotThrow(() => assertLocalDatabaseUrl(url), String(url));
    }
  });

  it("refuses scheme-less hosts, remote hosts, and prod-looking urls without echoing them", () => {
    const refused = [
      "example.turso.io",
      "libsql-host.example.com:8080",
      "localhost.evil.com",
      "local.db",
      "libsql://example.turso.io",
      "https://example.turso.io",
      "https://www.chess-school.in",
      "https://chess-school.in",
      "https://chess-school.vercel.app",
      "http://10.0.2.3",
      "http://10.0.2.2",
      "http://10.0.2.2:3210",
      "libsql://10.0.2.2",
      "http://10.0.2.2.evil.com",
    ];
    for (const url of refused) {
      assert.throws(() => assertLocalDatabaseUrl(url), /Refusing a remote DATABASE_URL/);
      try {
        assertLocalDatabaseUrl(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        assert.equal(message, "Refusing a remote DATABASE_URL.");
        assert.equal(message.includes(url), false);
      }
    }
  });
});
