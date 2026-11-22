import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { bootstrap } from "../src/db";
import { BOOTSTRAP_SQL } from "../src/schema";

/** Counts the statements a client is sent, like round trips to Turso. */
function counted() {
  const client = createClient({ url: ":memory:" });
  let calls = 0;
  return {
    client: { execute: (stmt: Parameters<typeof client.execute>[0]) => ((calls += 1), client.execute(stmt)) } as Pick<typeof client, "execute">,
    raw: client,
    calls: () => calls,
  };
}

describe("bootstrap", () => {
  it("creates everything on an empty database, then needs only two reads on a cold start", async () => {
    const db = counted();
    expect(await bootstrap(db.client)).toBeGreaterThan(50);
    const before = db.calls();
    expect(await bootstrap(db.client)).toBe(0);
    expect(db.calls() - before).toBe(2);
  });

  it("adds a column an older database is missing, and nothing else", async () => {
    const db = counted();
    await bootstrap(db.client, BOOTSTRAP_SQL.filter((s) => !/ADD COLUMN country/.test(s)).map((s) => s.replace(/,\s*country TEXT/, "")));
    const cols = async () => (await db.raw.execute("SELECT name FROM pragma_table_info('cs_profiles')")).rows.map((r) => r.name);
    expect(await cols()).not.toContain("country");
    expect(await bootstrap(db.client)).toBe(1);
    expect(await cols()).toContain("country");
  });
});
