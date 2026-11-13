import { createRequire } from "node:module";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { courseDocument } from "./course";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export async function openDb(url: string, authToken?: string): Promise<Db> {
  const client = createClient({ url, authToken });
  await client.execute("PRAGMA foreign_keys = ON");
  for (const sql of schema.BOOTSTRAP_SQL) {
    try {
      await client.execute(sql);
    } catch (err) {
      if (!/duplicate column name/i.test(String(err))) throw err;
    }
  }
  await client.execute({
    sql: "INSERT INTO cs_course (id, data) VALUES ('live', ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    args: [JSON.stringify(courseDocument())],
  });
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
