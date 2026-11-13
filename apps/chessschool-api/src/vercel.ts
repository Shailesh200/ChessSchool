import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "@hono/node-server/vercel";
import { createApp } from "./app";
import { openDb } from "./db";
import { appleVerifierFromEnv } from "./apple";
import { googleVerifierFromEnv } from "./google";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

async function boot() {
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
}

let ready: ReturnType<typeof boot> | undefined;

/** Boots once per instance; a failed boot (e.g. a DB timeout) is retried on the next request instead of being cached. */
export function getListener() {
  if (!ready) {
    ready = boot().catch((err) => {
      ready = undefined;
      console.error("[boot] failed, will retry on next request:", err);
      throw err;
    });
  }
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const listener = await getListener();
  return listener(req, res);
}
