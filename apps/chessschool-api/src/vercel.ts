import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "@hono/node-server/vercel";
import { createApp } from "./app";
import { openDb } from "./db";
import { appleVerifierFromEnv } from "./apple";
import { googleVerifierFromEnv } from "./google";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const ready = (async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const db = await openDb(url, process.env.DATABASE_AUTH_TOKEN);
  const app = createApp({
    db,
    google: googleVerifierFromEnv(process.env),
    apple: appleVerifierFromEnv(process.env),
    secureCookies: true,
    corsOrigins: list(process.env.CORS_ORIGINS),
  });
  return handle(app);
})();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const listener = await ready;
  return listener(req, res);
}
