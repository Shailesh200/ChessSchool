# chessschool-api

The new ChessSchool backend: Hono on Node, Drizzle over libSQL. It owns only `cs_*` tables and never touches the old curriculum/user schema.

```bash
pnpm --filter chessschool-api dev    # http://localhost:3300, SQLite file local.db
pnpm --filter chessschool-api test   # in-memory database
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3300` | |
| `DATABASE_URL` | `file:local.db` | Use a **new** Turso database for hosted envs, not the production one |
| `DATABASE_AUTH_TOKEN` | — | Turso token |
| `GOOGLE_CLIENT_IDS` | — | Comma-separated allowed audiences (web client ID + native client IDs). Unset → `/v1/auth/google` returns 503 |
| `CORS_ORIGINS` | `http://localhost:3100` | Only needed if a browser calls the API directly (the web app proxies `/v1/*`) |
| `NODE_ENV` | — | `production` sets the session cookie `Secure` |

## Hosting

Production is the Vercel project `chessschool-api` at **https://api.chess-school.in** (DNS: `A api → 76.76.21.21` at Namecheap), backed by the Turso database `chessschool-v2`. Its env vars (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `GOOGLE_CLIENT_IDS`) live in Vercel. It isn't connected to git; deploy from this folder:

```bash
pnpm build:vercel                      # esbuild bundle → .vercel/output (src/vercel.ts)
vercel deploy --prebuilt --prod --yes
curl https://api.chess-school.in/v1/health
```

Tables are created on boot (`BOOTSTRAP_SQL` in `src/schema.ts`). Routes, auth and merge rules: see `/PHASE1.md`; account deletion and feedback: `/PHASE3.md`.

## Course content

Lessons live in the database (`cs_course_units`, `cs_course_lessons`, and `cs_course` row `meta` for the version and coming-soon list). `GET /v1/course` and `GET /v1/lessons/:id` read only from these tables; lesson unlocking, the guest limit and progress checks use the lesson order stored there. Nothing is written to them at boot.

The editable source is `data/course.json`. To change lessons, edit it (practice units 20–42 are regenerated with `pnpm --filter chessschool-api build:practice` from the CC0 Lichess puzzles in `packages/puzzle-school`), bump `version`, then load it:

```bash
# local check: every lesson is played through with the app's lesson runner before anything is written
DATABASE_URL=file:local.db pnpm --filter chessschool-api seed:course            # dry-run
DATABASE_URL=file:local.db pnpm --filter chessschool-api seed:course --apply

# production (dry-run, then apply with the version from course.json)
pnpm --filter chessschool-api seed:course --remote-prod
pnpm --filter chessschool-api seed:course --remote-prod --apply --confirm-version <version>
```

A seed replaces the whole course in one batch. No app release or API deploy is needed; apps pick it up on their next course fetch.
