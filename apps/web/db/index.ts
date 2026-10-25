import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { resolveDatabaseUrl } from "./database-url";
import * as schema from "./schema";

/**
 * Drizzle DB client (libSQL) — one driver for both worlds:
 *   • local dev / local production build → DATABASE_URL unset → `file:local.db`
 *   • Vercel → DATABASE_URL must be `libsql:` or `https:` (no file fallback)
 * Cached on globalThis to survive HMR outside production.
 */
const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof drizzle> };

export const db =
  globalForDb.__db ??
  drizzle(
    createClient({
      url: resolveDatabaseUrl(process.env),
      authToken: process.env.DATABASE_AUTH_TOKEN,
    }),
    { schema },
  );

if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export { schema };
