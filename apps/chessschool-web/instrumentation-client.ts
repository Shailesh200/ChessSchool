import * as Sentry from "@sentry/nextjs";

// Browser crash reports only: no session replay, no tracing, no user data.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, sendDefaultPii: false, tracesSampleRate: 0, initialScope: { tags: { service: "web" } } });
}
