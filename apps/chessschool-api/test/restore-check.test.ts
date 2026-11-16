import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { readOnly, restoreCheck } from "../src/restore-check";
import { BOOTSTRAP_SQL } from "../src/schema";

async function source() {
  const db = createClient({ url: ":memory:" });
  for (const sql of BOOTSTRAP_SQL) await db.execute(sql).catch(() => {});
  for (let i = 0; i < 620; i++) await db.execute({ sql: "INSERT INTO cs_users (id, email, created_at) VALUES (?, ?, 0)", args: [`u${i}`, `u${i}@example.com`] });
  return db;
}
const mem = () => createClient({ url: ":memory:" });

describe("restore check", () => {
  it("copies every row (more than one page) and passes on the current schema", async () => {
    const report = await restoreCheck(await source(), mem(), mem());
    expect(report.problems).toEqual([]);
    expect(report.tables.find((t) => t.name === "cs_users")).toMatchObject({ source: 620, copied: 620 });
  });

  it("reports a table or column the live database lacks", async () => {
    const db = await source();
    await db.execute("DROP TABLE ota_updates");
    await db.execute("ALTER TABLE cs_feedback RENAME COLUMN message TO body");
    const report = await restoreCheck(db, mem(), mem());
    expect(report.problems).toContain("ota_updates: table is missing");
    expect(report.problems).toContain("cs_feedback.message: column is missing");
  });

  it("never sends a write to the source", async () => {
    const db = readOnly(await source());
    expect(() => db.execute("DELETE FROM cs_users")).toThrow(/refuses to write/);
    expect(() => db.execute({ sql: "UPDATE cs_users SET name = ?", args: ["x"] })).toThrow(/refuses to write/);
    expect((await db.execute("SELECT COUNT(*) AS n FROM cs_users")).rows[0]!.n).toBe(620);
  });
});
