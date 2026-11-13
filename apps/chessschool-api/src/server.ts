import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { openDb } from "./db";
import { createGoogleVerifier } from "./google";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const port = Number(process.env.PORT ?? 3300);
const db = await openDb(process.env.DATABASE_URL ?? "file:local.db", process.env.DATABASE_AUTH_TOKEN);
const google = createGoogleVerifier(list(process.env.GOOGLE_CLIENT_IDS));

const app = createApp({
  db,
  google,
  secureCookies: process.env.NODE_ENV === "production",
  corsOrigins: list(process.env.CORS_ORIGINS ?? "http://localhost:3100"),
});

serve({ fetch: app.fetch, port }, () => {
  console.log(`chessschool-api listening on http://localhost:${port} (google sign-in ${google ? "on" : "off"})`);
});
