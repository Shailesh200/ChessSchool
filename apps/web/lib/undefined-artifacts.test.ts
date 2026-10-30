import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.join(import.meta.dirname, "..");
const UNDEFINED_DIR = path.join(WEB_ROOT, "undefined");

describe("apps/web/undefined hygiene (DP-X-015)", () => {
  it("keeps apps/web/undefined free of tracked debug artefacts", () => {
    if (!fs.existsSync(UNDEFINED_DIR)) return;
    const entries = fs.readdirSync(UNDEFINED_DIR).filter((name) => !name.startsWith("."));
    expect(entries, `Remove debug files under apps/web/undefined: ${entries.join(", ")}`).toEqual(
      [],
    );
  });
});
