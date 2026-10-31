import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("vercel.json", () => {
  it("enables git deployments only on main and rc/nov2", () => {
    const cfg = JSON.parse(
      readFileSync(path.join(import.meta.dirname, "vercel.json"), "utf8"),
    ) as { git?: { deploymentEnabled?: Record<string, boolean> } };
    expect(cfg.git?.deploymentEnabled).toEqual({
      "*": false,
      main: true,
      "rc/nov2": true,
    });
  });
});
