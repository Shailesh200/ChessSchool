import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_ACTIONS = path.join(import.meta.dirname, "admin-actions.ts");

function createSemesterBlock(src: string): string {
  const start = src.indexOf("export async function createSemester");
  const end = src.indexOf("export async function createClass");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("createSemester server action (DP-W-008)", () => {
  it("validates semester fields through parseAdminSemesterFields before insert", () => {
    const src = fs.readFileSync(ADMIN_ACTIONS, "utf8");
    const block = createSemesterBlock(src);
    expect(block).toContain("parseAdminSemesterFields");
    expect(block).toMatch(/if \("error" in fields\) return \{ error: fields\.error \}/);
    expect(block).toContain("fields.data.color");
    expect(block).toContain("fields.data.stage");
  });
});
