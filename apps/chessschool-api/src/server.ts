import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { anthropicBoardReader } from "./scan";
import { providersFromEnv } from "./ai";
import { openDb } from "./db";
import { dbRateStore } from "./rate-limit";
import { otaFromEnv } from "./ota";
import { appleVerifierFromEnv } from "./apple";
import { googleVerifierFromEnv } from "./google";
import { anthropicLessonWriter } from "./lesson-draft";

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
  adminEmails: list(process.env.ADMIN_EMAILS),
  certSecret: process.env.CERT_SECRET,
  lessonWriter: anthropicLessonWriter(process.env.ANTHROPIC_API_KEY),
  boardReader: anthropicBoardReader(process.env.ANTHROPIC_API_KEY),
  coachAi: providersFromEnv(process.env),
  ota: otaFromEnv(db, process.env),
  rateStore: process.env.RATE_LIMITS === "off" ? null : dbRateStore(db),
  emailSecret: process.env.EMAIL_SECRET || null,
  apiOrigin: process.env.API_ORIGIN ?? `http://localhost:${port}`,
});

const hostname = process.env.HOST ?? "0.0.0.0";
serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`chessschool-api listening on http://${hostname}:${port} (google sign-in ${google ? "on" : "off"})`);
});
