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
| `GOOGLE_TTS_CREDENTIALS` | Optional | JSON for Google Cloud TTS |
| `TTS_PROVIDER` | Optional | Set `google` to use Cloud TTS; default Edge Read Aloud |

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
# Optional Google + Ably for local testing
```

## Mobile (`apps/mobile` / EAS)

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_API_URL` | Yes | API base (usually `https://chess-school.in`) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | OAuth | Same Google client ID as web for Sign-In |

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
