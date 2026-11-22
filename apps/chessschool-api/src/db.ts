import { createRequire } from "node:module";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** What already exists in the database: tables, indexes and each table's columns (lower case). */
type SchemaState = { tables: Set<string>; indexes: Set<string>; columns: Map<string, Set<string>> };

async function readSchema(client: Pick<Client, "execute">): Promise<SchemaState> {
  const objects = await client.execute("SELECT type, name FROM sqlite_master WHERE type IN ('table', 'index')");
  const cols = await client.execute("SELECT m.name AS t, p.name AS c FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table'");
  const state: SchemaState = { tables: new Set(), indexes: new Set(), columns: new Map() };
  for (const r of objects.rows) (r.type === "table" ? state.tables : state.indexes).add(String(r.name).toLowerCase());
  for (const r of cols.rows) {
    const t = String(r.t).toLowerCase();
    if (!state.columns.has(t)) state.columns.set(t, new Set());
    state.columns.get(t)!.add(String(r.c).toLowerCase());
  }
  return state;
}

/**
 * Whether a bootstrap statement still has work to do. CREATE ... IF NOT EXISTS and ADD COLUMN are skipped when
 * the object is already there; anything else (a backfill UPDATE, say) always runs.
 */
export function bootstrapNeeded(sql: string, s: SchemaState): boolean {
  const text = sql.trim();
  const table = /^CREATE TABLE IF NOT EXISTS\s+(\w+)/i.exec(text);
  if (table) return !s.tables.has(table[1]!.toLowerCase());
  const index = /^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS\s+(\w+)/i.exec(text);
  if (index) return !s.indexes.has(index[1]!.toLowerCase());
  const column = /^ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/i.exec(text);
  if (column) return !s.columns.get(column[1]!.toLowerCase())?.has(column[2]!.toLowerCase());
  return true;
}

/**
 * Applies BOOTSTRAP_SQL. It used to send every statement (about 90) one by one on each cold start: against
 * Turso that is ~90 sequential round trips before the first request is answered, which is what made the apps'
 * first health check time out and show "servers aren't answering". Now two reads find what is missing and
 * only that runs (nothing, on an up-to-date database).
 */
export async function bootstrap(client: Pick<Client, "execute">, statements: readonly string[] = schema.BOOTSTRAP_SQL): Promise<number> {
  let state: SchemaState | null = null;
  try {
    state = await readSchema(client);
  } catch (err) {
    console.warn("[bootstrap] schema read failed, applying every statement:", err);
  }
  let applied = 0;
  for (const sql of statements) {
    if (state && !bootstrapNeeded(sql, state)) continue;
    try {
      await client.execute(sql);
      applied++;
      if (state) console.log(`[bootstrap] applied: ${sql.trim().split(/\s+/).slice(0, 6).join(" ")}`);
    } catch (err) {
      if (!/duplicate column name/i.test(String(err))) throw err;
    }
  }
  return applied;
}

export async function openDb(url: string, authToken?: string): Promise<Db> {
  const client = createClient({ url, authToken });
  await client.execute("PRAGMA foreign_keys = ON");
  await bootstrap(client);
  return drizzle(client, { schema });
}

/** True for SELECT, WITH, and a read-only PRAGMA (no assignment). */
export function isReadOnlySql(sql: string): boolean {
  const text = sql.trim().replace(/^\/\*[\s\S]*?\*\//, "").trim().toLowerCase();
  if (text.startsWith("select") || text.startsWith("with")) return true;
  return text.startsWith("pragma") && !text.includes("=");
}

type ReadOnlyConnection = {
  prepare: (sql: string) => {
    raw: (flag: boolean) => void;
    columns: () => { name: string }[];
    all: (args?: unknown) => unknown[];
  };
  close: () => void;
};

function loadLibsql(): new (filename: string, options?: { fileMustExist?: boolean }) => ReadOnlyConnection {
  const requireClient = createRequire(createRequire(import.meta.url).resolve("@libsql/client"));
  return requireClient("libsql");
}

/** `file:` URL passed straight to sqlite as `file:<path>?mode=ro`. The libsql client rejects that query parameter. */
function readOnlyFileUri(url: string): string {
  let path = url.slice("file:".length);
  if (path.startsWith("//localhost")) path = path.slice("//localhost".length);
  else if (path.startsWith("//")) path = path.slice(1);
  const query = path.indexOf("?");
  if (query >= 0) path = path.slice(0, query);
  return `file:${path}?mode=ro`;
}

function rowFromRaw(values: unknown[], columns: string[]) {
  const row: Record<string | number, unknown> = {};
  Object.defineProperty(row, "length", { value: values.length });
  values.forEach((value, index) => {
    const normalized = typeof value === "bigint" ? Number(value) : value;
    Object.defineProperty(row, index, { value: normalized });
    const column = columns[index];
    if (column && !Object.hasOwn(row, column)) Object.defineProperty(row, column, { value: normalized, enumerable: true, configurable: true, writable: true });
  });
  return row;
}

function executeReadOnly(database: ReadOnlyConnection, stmt: unknown) {
  const sql = typeof stmt === "string" ? stmt : ((stmt as { sql?: string }).sql ?? "");
  const args = typeof stmt === "string" ? [] : ((stmt as { args?: unknown }).args ?? []);
  if (!isReadOnlySql(sql)) throw new Error("read-only connection refuses writes");
  const prepared = database.prepare(sql);
  let returnsData = true;
  try {
    prepared.raw(true);
  } catch {
    returnsData = false;
  }
  if (!returnsData) throw new Error("read-only connection refuses writes");
  const columns = prepared.columns().map((column) => column.name);
  const rawRows = prepared.all(args);
  const rows = rawRows.map((raw) => rowFromRaw(Array.isArray(raw) ? raw : [], columns));
  return { columns, rows, rowsAffected: 0 };
}

/**
 * Opens a database for a dry-run. A file is opened with sqlite `mode=ro` and no schema or seed statements.
 * A remote client is wrapped as-is and is not migrated.
 */
export async function openReadOnlyDb(url: string, authToken?: string, remoteClient?: Pick<Client, "execute">): Promise<Db> {
  if (url.startsWith("file:")) {
    const Database = loadLibsql();
    const database = new Database(readOnlyFileUri(url), { fileMustExist: true });
    const client = { execute: async (stmt: unknown) => executeReadOnly(database, stmt), close: () => database.close() };
    return drizzle(client as unknown as Client, { schema });
  }
  const client = (remoteClient ?? createClient({ url, authToken })) as Client;
  return drizzle(client, { schema });
}
