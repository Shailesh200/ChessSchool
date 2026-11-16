import type { Client } from "@libsql/client";
import { isReadOnlySql } from "./db";
import { BOOTSTRAP_SQL } from "./schema";

/**
 * Backup drill: copies every table of a source database into a local one and checks the copy. It proves the
 * data can be read out in full and that the live schema still has everything BOOTSTRAP_SQL creates.
 * The source is only ever read: every statement sent to it goes through `readOnly`, which refuses writes
 * (on top of the read-only token the workflow uses).
 */

type Sql = Pick<Client, "execute">;
export type RestoreReport = { tables: { name: string; source: number; copied: number }[]; problems: string[] };

const PAGE = 500;
const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Wraps a client so that anything but SELECT / WITH / a read-only PRAGMA throws before it is sent. */
export function readOnly(client: Sql): Sql {
  return {
    execute: ((stmt: string | { sql: string }) => {
      const sql = typeof stmt === "string" ? stmt : stmt.sql;
      if (!isReadOnlySql(sql)) throw new Error("restore check refuses to write to the source database");
      return client.execute(stmt as never);
    }) as Client["execute"],
  };
}

const count = async (db: Sql, table: string) => Number((await db.execute(`SELECT COUNT(*) AS n FROM ${q(table)}`)).rows[0]!.n);
const columns = async (db: Sql, table: string) => (await db.execute(`SELECT name FROM pragma_table_info('${table.replace(/'/g, "''")}')`)).rows.map((r) => String(r.name));

export async function restoreCheck(sourceClient: Sql, target: Sql, expected: Sql): Promise<RestoreReport> {
  const source = readOnly(sourceClient);
  const report: RestoreReport = { tables: [], problems: [] };
  const master = await source.execute(`SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%' AND sql IS NOT NULL ORDER BY name`);

  await target.execute("PRAGMA foreign_keys = OFF");
  for (const t of master.rows) {
    const name = String(t.name);
    const before = await count(source, name);
    await target.execute(String(t.sql));
    const cols = await columns(source, name);
    const insert = `INSERT INTO ${q(name)} (${cols.map(q).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
    let copied = 0;
    for (let offset = 0; ; offset += PAGE) {
      const page = await source.execute({ sql: `SELECT ${cols.map(q).join(", ")} FROM ${q(name)} LIMIT ? OFFSET ?`, args: [PAGE, offset] });
      for (const row of page.rows) await target.execute({ sql: insert, args: cols.map((c) => row[c] as never) });
      copied += page.rows.length;
      if (page.rows.length < PAGE) break;
    }
    const after = await count(source, name);
    const local = await count(target, name);
    report.tables.push({ name, source: after, copied: local });
    // The source is live, so rows may arrive during the copy: the copy must land between the two counts.
    if (local !== copied || local < Math.min(before, after) || local > Math.max(before, after)) report.problems.push(`${name}: copied ${local} rows, source had ${before} before and ${after} after`);
  }

  // Schema: every table and column BOOTSTRAP_SQL creates must exist in the copy.
  for (const sql of BOOTSTRAP_SQL) await expected.execute(sql).catch(() => {});
  const want = await expected.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`);
  for (const t of want.rows) {
    const name = String(t.name);
    const have = new Set(await columns(target, name));
    if (!have.size) {
      report.problems.push(`${name}: table is missing`);
      continue;
    }
    for (const c of await columns(expected, name)) if (!have.has(c)) report.problems.push(`${name}.${c}: column is missing`);
  }
  return report;
}
