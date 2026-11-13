import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { openDb } from "./db";
import { appleVerifierFromEnv } from "./apple";
import { googleVerifierFromEnv } from "./google";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const port = Number(process.env.PORT ?? 3300);
const db = await openDb(process.env.DATABASE_URL ?? "file:local.db", process.env.DATABASE_AUTH_TOKEN);
const google = googleVerifierFromEnv(process.env);

const app = createApp({
  db,
  google,
  apple: appleVerifierFromEnv(process.env),
  secureCookies: process.env.NODE_ENV === "production",
  corsOrigins: list(process.env.CORS_ORIGINS ?? "http://localhost:3100"),
});

const hostname = process.env.HOST ?? "0.0.0.0";
serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`chessschool-api listening on http://${hostname}:${port} (google sign-in ${google ? "on" : "off"})`);
});
