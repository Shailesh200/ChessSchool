import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeCaptureHost } from "./capture.mjs";

describe("assertSafeCaptureHost", () => {
  it("allows localhost, loopback, and a -git- preview", () => {
    assert.doesNotThrow(() => assertSafeCaptureHost("http://localhost:3000"));
    assert.doesNotThrow(() => assertSafeCaptureHost("http://127.0.0.1:3000"));
    assert.doesNotThrow(() => assertSafeCaptureHost("https://chess-school-git-f12.vercel.app"));
  });

  it("refuses the production domain, the bare Vercel alias, and any other host", () => {
    assert.throws(() => assertSafeCaptureHost("https://chess-school.in"), /Refusing to register a capture user on chess-school\.in/);
    assert.throws(
      () => assertSafeCaptureHost("https://chess-school.vercel.app"),
      /Refusing to register a capture user on chess-school\.vercel\.app/,
    );
    assert.throws(() => assertSafeCaptureHost("https://example.com/play"), /Refusing to register a capture user on example\.com/);
  });
});
