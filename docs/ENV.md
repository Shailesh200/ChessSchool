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
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth client secret |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth | Same client ID — shows “Continue with Google” |
| `ABLY_API_KEY` | Optional | Realtime PvP push; without it → polling fallback |
| `ELEVENLABS_API_KEY` | Optional | ElevenLabs TTS for named coach characters. Uses each voice’s saved Voice Lab settings + preferred model (e.g. Skye/Aerisita → Turbo v2.5). **Library/professional voices require a paid ElevenLabs plan for API calls** — Free can preview in Voice Lab but `/v1/text-to-speech` returns `paid_plan_required` and the app falls back to Edge (will not match Voice Lab). When unset or blocked, Edge Read Aloud is used. |
| `GOOGLE_TTS_CREDENTIALS` | Optional | JSON for Google Cloud TTS |
| `TTS_PROVIDER` | Optional | Set `google` to prefer Cloud TTS after ElevenLabs; default Edge Read Aloud when ElevenLabs unset |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry DSN for browser + fallback for server |
| `SENTRY_DSN` | Optional | Server/edge Sentry DSN (falls back to `NEXT_PUBLIC_SENTRY_DSN`) |
| `SENTRY_AUTH_TOKEN` | Optional | Build-time auth token for source map upload (`withSentryConfig`) |

Sentry sampling: `tracesSampleRate` 0.05 in production (1.0 in development), `sendDefaultPii: false`, no session replay. Tunnel route: `/sentry-tunnel`. Org `shailesh-jha` / project `chessschool-web`.

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
# Optional: coach character TTS (matches Voice Lab voice settings); without it → Edge
# ELEVENLABS_API_KEY=
# Optional Google + Ably for local testing
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
