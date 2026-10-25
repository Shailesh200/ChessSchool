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

## Content rollout (`db:remote`)

Sanji's D-1 content rollout uses this procedure. `db/seed.sql` is a content snapshot: idempotent `INSERT ... ON CONFLICT(id) DO UPDATE` for `semesters`, `classes`, `lessons`, and `homework_lessons` only. It has no `DROP` or `CREATE TABLE`. Schema changes go through `db:migrate`. Lesson and class ids stay the values in the snapshot.

The snapshot does not touch `users`, `sessions`, `oauth_accounts`, `profiles`, `progress`, `lesson_records`, `game_sessions`, `analytics_events`, or `web_vitals`. Rows removed from the snapshot are left in the database. Deleting them could orphan progress (`lesson_records.lesson_id` and progress JSON are not foreign keys), and `ON DELETE CASCADE` from semesters or classes would remove lessons those rows still name.

`pnpm --filter web db:remote` writes only when every guard below passes. It prints the database hostname and never prints `DATABASE_URL` or `DATABASE_AUTH_TOKEN`.

1. Rebuild the local file, then regenerate the snapshot. Dump reads `apps/web/local.db` only and ignores `DATABASE_URL`. It refuses when any content table would have fewer rows than the current `db/seed.sql` (a fresh local database is 118 lessons, smaller than the puzzle snapshot). Pass `--allow-shrink` only when that drop is intentional.

   ```bash
   pnpm --filter web db:dump
   pnpm --filter web db:dump -- --allow-shrink
   ```

2. The target must already have a `__drizzle_migrations` row. On the push-era Turso database, record the baseline first (`plans/M-073_WEB_GA_LAUNCH.md`), then `pnpm --filter web db:migrate`. `db:remote` refuses an unmigrated database and writes nothing.

3. Take a Turso backup: `turso db shell <db>` to inspect, or create a database branch / point-in-time restore.

4. Dry run (the default). `CONFIRM` must equal the hostname exactly as written in `DATABASE_URL`, including case (no scheme, port, path, or token). This connects only to read the migration journal.

   ```bash
   cd apps/web
   export DATABASE_URL='libsql://<hostname>'
   export DATABASE_AUTH_TOKEN='…'
   export CONFIRM='<hostname>'
   pnpm db:remote
   ```

   The output lists how many rows would be upserted per content table. It writes nothing.

5. Apply after the backup exists:

   ```bash
   pnpm db:remote -- --apply --backup-done
   ```

Re-running is safe: the same ids are updated in place. Live games and accounts stay. `db:fresh` rebuilds local `local.db` only (migrate, then the local generators: 118 lessons and 46 homework lessons) and ignores `DATABASE_URL`. That local count is separate from the puzzle snapshot in `db/seed.sql`.

`db:wipe-users` and `db:remote-clean` delete user rows. They are not the content rollout. Both refuse every host in `PRODUCTION_DB_HOSTS` (`chessschool-shailesh200.aws-ap-south-1.turso.io`) even when confirm matches. Confirm is `CONFIRM=WIPE:<hostname>`: the exact hostname of `DATABASE_URL`, or `local.db` when `db:wipe-users` targets the local file. The command prints that hostname only, never the URL or auth token.

```bash
CONFIRM=WIPE:local.db pnpm --filter web db:wipe-users
CONFIRM='WIPE:<hostname>' pnpm --filter web db:remote-clean
```

## Related

- Operational guide: [`CLAUDE.md`](../CLAUDE.md)
- Security audit: [`plans/M-070_SECURITY_AUDIT.md`](../plans/M-070_SECURITY_AUDIT.md)
- Mobile store: [`apps/mobile/RELEASE.md`](../apps/mobile/RELEASE.md)
