# Database

Curriculum lives in `seed.sql` (loaded by `pnpm db:load-seed`) and is regenerated
by `scripts/seed.mjs` (`pnpm db:seed`). Neither file contains user accounts.

## Test user Alex (made up, test-only)

Alex is a fictional student for the native Play Store screenshot job: a Maestro
flow on an Android emulator against an API on the CI runner. **Alex is not a
real person and is not part of the main seed.** Do not add this account to
`seed.sql` or `scripts/seed.mjs`.

The script inserts or updates one student and is safe to run again. It gives
Alex a 4-day streak and 50 XP from the first four Chess Basics lessons (The
Chess Board), which is what the home header reads: a streak count and a
partial level-1 XP bar (50 / 100). The profile is already onboarded and
`progress.data` has no coach settings, so the app keeps the default coach.

Apply the local schema first (`pnpm --filter web db:push` or `db:fresh`), then:

```bash
pnpm --filter web db:seed:test-user
# from the repo root:
pnpm db:seed:test-user
```

With `DATABASE_URL` unset, that writes `apps/web/local.db`.

|          |                               |
| -------- | ----------------------------- |
| Email    | `alex@test.chessschool.local` |
| Password | `AlexTestOnly1`               |

These credentials are invented. They are only for a local or in-memory database.

### Local-only guard

The script runs only for a local database. Anything else exits non-zero and
writes nothing. It never prints `DATABASE_URL` or the auth token. Local targets:

- `file:` URLs (including the default `local.db` and `file::memory:`)
- `:memory:`
- `http:`, `https:`, or `libsql:` whose host is `localhost` or `127.0.0.1`

It also refuses production hosts from `production-db-hosts.mjs`
(`isProductionDbHost`), including a `file:` URL whose hostname is that
production host. Any other remote URL is refused even when it is not production.
