import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYTICS_SWITCH_HINT, ANALYTICS_SWITCH_LABEL } from "./copy";

// The app's switch wording: one switch, off until you turn it on. Same words as the web.
describe("copy: the app's analytics switch", () => {
  it("says it is one switch for analytics and performance, off until turned on", () => {
    expect(ANALYTICS_SWITCH_LABEL).toBe("Share analytics & performance");
    expect(ANALYTICS_SWITCH_HINT).toBe(
      "Off until you turn it on. One switch for usage analytics and performance sharing.",
    );
  });

  it("the settings screen shows them, and the web copy is identical", () => {
    const screen = readFileSync(
      path.resolve(__dirname, "../../app/settings.tsx"),
      "utf8",
    );
    expect(screen).toContain("{ANALYTICS_SWITCH_LABEL}");
    expect(screen).toContain("{ANALYTICS_SWITCH_HINT}");
    expect(screen).not.toContain("Share usage analytics");
    const web = readFileSync(
      path.resolve(__dirname, "../../../web/core/analytics/copy.ts"),
      "utf8",
    );
    expect(web).toContain(JSON.stringify(ANALYTICS_SWITCH_LABEL));
    expect(web).toContain(JSON.stringify(ANALYTICS_SWITCH_HINT));
  });
});
