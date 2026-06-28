import { defineConfig } from "drizzle-kit";

/**
 * Env-driven: no DATABASE_URL → local SQLite file; a libsql:// URL → Turso.
 *   local:  pnpm db:push
 *   turso:  DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… pnpm db:push
 */
const url = process.env.DATABASE_URL ?? "file:local.db";
const isRemote = url.startsWith("libsql:") || url.startsWith("http");

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
