import { defineConfig } from "drizzle-kit";
import { isRemoteDriverUrl, resolveDatabaseUrl } from "./db/database-url";

/**
 * Env-driven: no DATABASE_URL → local SQLite file; a libsql:// URL → Turso.
 * On Vercel, a missing or non-hosted DATABASE_URL throws (see database-url.ts).
 *   local:  pnpm db:push
 *   turso:  DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… pnpm db:push
 */
const url = resolveDatabaseUrl(process.env);
const isRemote = isRemoteDriverUrl(url);

export default isRemote
  ? defineConfig({
      dialect: "turso",
      schema: "./db/schema.ts",
      out: "./db/migrations",
      dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN },
    })
  : defineConfig({
      dialect: "sqlite",
      schema: "./db/schema.ts",
      out: "./db/migrations",
      dbCredentials: { url: url.replace(/^file:/, "") },
    });
