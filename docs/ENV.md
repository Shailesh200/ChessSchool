# ChessSchool — Environment variables

Authoritative checklist for local, Vercel (web), and EAS (mobile).  
Launch go-live steps: [`plans/M-073_WEB_GA_LAUNCH.md`](../plans/M-073_WEB_GA_LAUNCH.md).

## Web (`apps/web` / Vercel)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Prod | Turso `libsql://…` URL. Unset locally → `apps/web/local.db` |
| `DATABASE_AUTH_TOKEN` | Prod | Turso auth token |
| `SESSION_TOKEN_SECRET` | Prod | HMAC for online PvP seat tokens |
| `CRON_SECRET` | Prod | Protects session cleanup cron |
| `NEXT_PUBLIC_APP_URL` | Prod | Canonical site URL (e.g. `https://chess-school.in`) |
| `NPM_TOKEN` | Install | GitHub PAT with `read:packages` so Vercel can install `@shailesh200/pulse-tracker`. Must be available at **install/build**, Production **and** Preview. Not an npmjs.com token. |
| `NEXT_PUBLIC_PULSE_WEBSITE_ID` | Prod | Umami website id (`4bb7a0af-823c-4a21-a4ab-509a7815cf02`). Inlined at build time. |
| `NEXT_PUBLIC_PULSE_ORIGIN` | Optional | Pulse origin override. Defaults to `https://pulse.shaileshjha.in`. Do **not** use `VITE_PUBLIC_UMAMI_URL` — this app is Next.js. |
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth client secret |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth | Same client ID — shows “Continue with Google” |
| `ABLY_API_KEY` | Optional | Realtime PvP push; without it → polling fallback |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST URL. With the matching token, rate limits are shared across serverless instances. Set by the Vercel Marketplace Upstash integration (`Redis.fromEnv`). |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis REST token paired with `UPSTASH_REDIS_REST_URL`. Never commit. |
| `KV_REST_API_URL` | Optional | Legacy KV / Marketplace alias for the Redis REST URL. Used only when the `UPSTASH_REDIS_REST_*` pair is not both set. |
| `KV_REST_API_TOKEN` | Optional | REST token paired with `KV_REST_API_URL`. Never commit. |
| `ELEVENLABS_API_KEY` | Optional | ElevenLabs TTS for named coach characters. Uses each voice’s saved Voice Lab settings + preferred model (e.g. Skye/Aerisita → Turbo v2.5). **Library/professional voices require a paid ElevenLabs plan for API calls** — Free can preview in Voice Lab but `/v1/text-to-speech` returns `paid_plan_required` and the app falls back to on-device speech (will not match Voice Lab). When unset or blocked, the browser or device speaks the line. |
| `GOOGLE_TTS_CREDENTIALS` | Optional | JSON for Google Cloud TTS |
| `TTS_PROVIDER` | Optional | Set `google` to use Cloud TTS after ElevenLabs. When neither ElevenLabs nor Google is available, coach lines use on-device speech. |
| `EMAIL_PROVIDER` | Prod email | Transactional provider. `resend` sends with the Resend HTTP API when `RESEND_API_KEY` and `EMAIL_FROM` are also set. Otherwise the console transport is used in dev, test, CI, and any `VERCEL_ENV` other than `production` (preview included), even when `NODE_ENV` is production. Fails closed when `VERCEL_ENV=production`, or when `VERCEL_ENV` is unset and `NODE_ENV=production`. `CI` does not change that. |
| `RESEND_API_KEY` | Prod email | Resend API key. Required together with `EMAIL_PROVIDER=resend` and `EMAIL_FROM`. |
| `EMAIL_FROM` | Prod email | From address for transactional mail. Required together with `EMAIL_PROVIDER=resend` and `RESEND_API_KEY`. |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry DSN for browser + fallback for server |
| `SENTRY_DSN` | Optional | Server/edge Sentry DSN (falls back to `NEXT_PUBLIC_SENTRY_DSN`) |
| `SENTRY_AUTH_TOKEN` | Optional | Build-time auth token for source map upload (`withSentryConfig`) |

Sentry sampling: `tracesSampleRate` 0.05 in production (1.0 in development), `sendDefaultPii: false`, no session replay. Tunnel route: `/sentry-tunnel`. Org `shailesh-jha` / project `chessschool-web`.

### Shared rate limits

`apps/web/lib/rate-limit.ts` uses an in-memory fixed window unless a **complete** credential pair is present. Local dev, tests, and CI leave these unset.

1. `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (preferred; what `@upstash/redis` `Redis.fromEnv()` reads first)
2. `KV_REST_API_URL` + `KV_REST_API_TOKEN` (name still used by some Marketplace / former Vercel KV installs)

A URL without its own token does not enable Redis. The two pairs are not mixed. When Redis is selected, `@upstash/ratelimit` stores the counters (`slidingWindow` for `auth:login` and `auth:register`, `fixedWindow` otherwise). If Redis errors or times out, that request is counted on the in-memory limiter and the failure is logged once per instance (console and Sentry). Provision the database from the Vercel Marketplace (Upstash Redis, free plan); it is not created by this repo.

Keys are prefixed with `chess-school:rl:${VERCEL_ENV}` (`local` when `VERCEL_ENV` is unset). Vercel sets `VERCEL_ENV` to `production`, `preview`, or `development`. Give staging its own Upstash database; the prefix only stops a shared database from mixing those counters.

### Google OAuth redirect

```
{NEXT_PUBLIC_APP_URL}/api/auth/google/callback
```

Production example: `https://chess-school.in/api/auth/google/callback`

### Local example

```bash
# apps/web/.env.local (never commit secrets)
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_TOKEN_SECRET=dev-session-token-secret-at-least-32-chars
# DATABASE_URL unset → local.db
# Optional: coach character TTS (matches Voice Lab voice settings); without it → on-device speech
# ELEVENLABS_API_KEY=
# Optional transactional email. Unset → console transport in dev, test, CI, and Vercel preview.
# Production fails closed: VERCEL_ENV=production, or NODE_ENV=production when VERCEL_ENV is unset.
# EMAIL_PROVIDER=
# RESEND_API_KEY=
# EMAIL_FROM=
# Optional Google + Ably for local testing
# Optional shared rate limits — omit locally; in-memory limiter is the default
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
```

## Mobile (`apps/mobile` / EAS)

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_API_URL` | Yes | API base (`https://www.chess-school.in` — prefer www over apex) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | OAuth | Same Google client ID as web for Sign-In |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional | Mobile Sentry DSN (`@sentry/react-native`). Set in `eas.json` `env` for local/prod builds (and `.env` for Metro). Org `shailesh-jha` / project `chessschool-mobile`. Source-map upload needs `SENTRY_AUTH_TOKEN` (not in git); local builds use `SENTRY_DISABLE_AUTO_UPLOAD=true` |

Bundle-time inlined — changing values requires a new native build or OTA-compatible rebuild (`expo start -c` locally).

## Cron / CI

| Variable | Where | Purpose |
|----------|-------|---------|
| `CRON_SECRET` | Vercel | Authorization header for cleanup cron |
| `CI` | GitHub Actions | Set by CI; used by verify scripts |

## Related

- Operational guide: [`CLAUDE.md`](../CLAUDE.md)
- Security audit: [`plans/M-070_SECURITY_AUDIT.md`](../plans/M-070_SECURITY_AUDIT.md)
- Mobile store: [`apps/mobile/RELEASE.md`](../apps/mobile/RELEASE.md)
