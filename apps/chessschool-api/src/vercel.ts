import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "@hono/node-server/vercel";
import * as Sentry from "@sentry/node";
import { createApp } from "./app";
import { providersFromEnv } from "./ai";
import { senderFromEnv } from "./weekly";
import { openDb } from "./db";
import { otaFromEnv } from "./ota";
import { appleVerifierFromEnv } from "./apple";
import { googleVerifierFromEnv } from "./google";
import { anthropicLessonWriter } from "./lesson-draft";
import { anthropicBoardReader } from "./scan";
import { cardStoreFromEnv } from "./share-card";
import { photoStoreFromEnv } from "./social";
import { cached } from "./growth-stats";
import { dbRateStore } from "./rate-limit";
import { sentryReleaseHealth } from "ota-server";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// No request data, users or IPs are sent: only the error and its stack.
const sentry = Boolean(process.env.SENTRY_DSN);
if (sentry) Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.VERCEL_ENV ?? "production", sendDefaultPii: false, tracesSampleRate: 0, initialScope: { tags: { service: "api" } } });
const reportError = async (err: unknown) => {
  if (!sentry) return;
  Sentry.captureException(err);
  await Sentry.flush(2000);
};

async function boot() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  // In parallel: the database bootstrap is network-bound, the stores only load the S3 SDK.
  const [db, cardStore, photoStore] = await Promise.all([openDb(url, process.env.DATABASE_AUTH_TOKEN), cardStoreFromEnv(process.env), photoStoreFromEnv(process.env)]);
  const app = createApp({
    db,
    google: googleVerifierFromEnv(process.env),
    apple: appleVerifierFromEnv(process.env),
    secureCookies: true,
    corsOrigins: list(process.env.CORS_ORIGINS),
    adminEmails: list(process.env.ADMIN_EMAILS),
    certSecret: process.env.CERT_SECRET,
    coachAi: providersFromEnv(process.env),
    reportError,
    weekly: senderFromEnv(process.env),
    cronSecret: process.env.CRON_SECRET,
    lessonWriter: anthropicLessonWriter(process.env.ANTHROPIC_API_KEY),
    boardReader: anthropicBoardReader(process.env.ANTHROPIC_API_KEY),
    ota: otaFromEnv(db, process.env),
    cardStore,
    photoStore,
    rateStore: process.env.RATE_LIMITS === "off" ? null : dbRateStore(db),
    // Unsubscribe links are signed with EMAIL_SECRET; until it is set, welcome and come-back emails stay off.
    emailSecret: process.env.EMAIL_SECRET || null,
    apiOrigin: process.env.API_ORIGIN ?? "https://api.chess-school.in",
    // Optional: with SENTRY_READ_TOKEN the growth dashboard shows crash-free sessions (asked at most hourly).
    crashFree: process.env.SENTRY_READ_TOKEN
      ? cached(async () => {
          const h = await sentryReleaseHealth({ token: process.env.SENTRY_READ_TOKEN!, org: process.env.SENTRY_ORG ?? "shailesh-jha", project: process.env.SENTRY_PROJECT ?? "chessschool-mobile" });
          return h?.crashFreeRate != null ? Math.round(h.crashFreeRate * 1000) / 10 : null;
        }, 60 * 60_000)
      : undefined,
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
      void reportError(err);
      throw err;
    });
  }
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const listener = await getListener();
  return listener(req, res);
}
