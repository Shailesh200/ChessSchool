import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("web lottie peer shim", () => {
  it("resolves the missing dotlottie web peer without adding a dependency", () => {
    const metro = readFileSync(path.resolve(__dirname, "../metro.config.js"), "utf8");
    expect(metro).toContain("@lottiefiles/dotlottie-react");
    expect(metro).toContain("dotlottie-react.web.js");
    expect(metro).toContain('originModulePath: appOrigin');
    const shim = readFileSync(path.resolve(__dirname, "shims/dotlottie-react.web.js"), "utf8");
    expect(shim).toContain("DotLottieReact");
  });
});