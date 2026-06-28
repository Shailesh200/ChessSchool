import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * Drizzle DB client (libSQL) — one driver for both worlds:
 *   • local dev  → DATABASE_URL unset  → a local SQLite file (`file:local.db`)
 *   • production → DATABASE_URL=libsql://… + DATABASE_AUTH_TOKEN → Turso (edge)
 * No app code changes between environments. Cached on globalThis to survive HMR.
 */
function resolveUrl(raw: string | undefined): string {
  const v = raw ?? "file:local.db";
  if (v.startsWith("libsql:") || v.startsWith("http:") || v.startsWith("https:") || v.startsWith("file:"))
    return v;
  return `file:${v}`; // bare path → local file
}

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof drizzle> };

export const db =
  globalForDb.__db ??
  drizzle(
    createClient({
      url: resolveUrl(process.env.DATABASE_URL),
      authToken: process.env.DATABASE_AUTH_TOKEN,
    }),
    { schema },
  );

if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export { schema };
