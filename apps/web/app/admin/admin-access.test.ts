import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_PAGE = path.join(import.meta.dirname, "page.tsx");

describe("admin access copy (DP-W-007)", () => {
  it("does not expose developer DB instructions to non-admins", () => {
    const src = fs.readFileSync(ADMIN_PAGE, "utf8");
    expect(src).not.toMatch(/db:studio/i);
    expect(src).not.toMatch(/users\.role|users table/i);
    expect(src).toMatch(/not authorized/i);
  });
});
