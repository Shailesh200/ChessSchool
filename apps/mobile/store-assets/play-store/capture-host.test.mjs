import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeCaptureHost } from "./capture-host.mjs";

describe("assertSafeCaptureHost", () => {
  it("allows localhost, loopback, and a branch preview", () => {
    assert.doesNotThrow(() => assertSafeCaptureHost("http://localhost:3000"));
    assert.doesNotThrow(() => assertSafeCaptureHost("http://127.0.0.1:3000"));
    assert.doesNotThrow(() =>
      assertSafeCaptureHost("https://chess-school-git-lane-f-f12-shailesh200.vercel.app"),
    );
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
