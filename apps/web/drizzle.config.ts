import { defineConfig } from "drizzle-kit";

/**
 * Env-driven: no DATABASE_URL → local SQLite file; a libsql:// URL → Turso.
 *   generate:  pnpm db:generate -- --name <slug>
 *   apply:     pnpm db:migrate
 * Existing databases (production Turso) must record 0000 before the first
 * migrate: pnpm db:baseline. See plans/M-073_WEB_GA_LAUNCH.md.
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
