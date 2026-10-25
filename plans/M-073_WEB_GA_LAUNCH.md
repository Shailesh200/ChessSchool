# M-073 — Web GA Launch Readiness

**Status:** Verified (2026-07-17)  
**Gate:** G-WebGA (final)  
**Branch:** `milestone/M-073-web-ga-launch`

## Scope

Ship the last Web GA gate: go-live checklist, ops + support runbooks, env
reference, and public trust pages (About / Support / Terms). Product and SEO
landings already exist (`/`, `/learn-chess`, `/chess-for-beginners`, `/privacy`).

## Deliverables

| Item | Path |
|------|------|
| Milestone + checklists | `plans/M-073_WEB_GA_LAUNCH.md` (this file) |
| Env reference | `docs/ENV.md` |
| About | `/about` → `apps/web/app/about/page.tsx` |
| Support | `/support` → `apps/web/app/support/page.tsx` |
| Terms | `/terms` → `apps/web/app/terms/page.tsx` |
| Footer / SEO / e2e wiring | LandingShell, sitemap, route manifests |

## Go-live checklist

Complete before public promotion of https://chess-school.in:

### Platform

- [ ] Vercel project **Root Directory** = `apps/web`
- [ ] Production deploys from `main` succeed (CI green)
- [ ] Custom domain `chess-school.in` + HTTPS

### Environment (see `docs/ENV.md`)

- [ ] `DATABASE_URL` + `DATABASE_AUTH_TOKEN` (Turso production)
- [ ] `SESSION_TOKEN_SECRET` set (PvP seat tokens)
- [ ] `CRON_SECRET` set (session cleanup cron)
- [ ] `NEXT_PUBLIC_APP_URL=https://chess-school.in`
- [ ] Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- [ ] Google Cloud redirect URI: `https://chess-school.in/api/auth/google/callback`
- [ ] Optional: `ABLY_API_KEY` (realtime; polling works without)
- [ ] Optional TTS: `GOOGLE_TTS_CREDENTIALS` + `TTS_PROVIDER=google` only if GCP billing enabled

### Content & trust

- [ ] `/privacy`, `/terms`, `/about`, `/support` live and linked from footer
- [ ] Curriculum rolled out with the guarded content snapshot (`docs/ENV.md`, dry-run `db:remote`, then `--apply --backup-done`)
- [ ] Admin account exists for CMS (`UPDATE users SET role='admin' …`)

### Quality gates

- [ ] `pnpm verify:milestone` green on release commit
- [ ] Smoke production: `/`, `/login`, `/academy`, `/privacy`, `/support`
- [ ] Register + login + one guest lesson + enroll prompt (M-057)
- [ ] Google sign-in once with a test account
- [ ] Online PvP create/join once (auth seats)

### Promotion

- [ ] Owner sign-off on this checklist
- [ ] Mark M-073 **Verified** in master plan
- [ ] Public marketing / sharing allowed (G-WebGA complete)

## Ops runbook

### Deploy

- Push or merge to `main` → Vercel builds `apps/web`.
- No separate API deploy — App Router + route handlers on Vercel.
- After schema changes: `pnpm --filter web db:generate -- --name <slug>`, commit `apps/web/db/migrations`, then `pnpm --filter web db:migrate`.
- The live Turso database was created by `drizzle-kit push` and `db/seed.sql`. Record `0000_baseline` before the first production `db:migrate` (procedure below). Do not replay `0000_baseline.sql` on that database.

### Database

- Local: unset `DATABASE_URL` → `apps/web/local.db`. `pnpm --filter web db:fresh` deletes that file, applies committed migrations, and seeds. It ignores `DATABASE_URL` / `DATABASE_AUTH_TOKEN`.
- Production: Turso via `DATABASE_URL` + `DATABASE_AUTH_TOKEN`.
- New empty database: `pnpm --filter web db:migrate` creates tables from `apps/web/db/migrations`, then seed.
- Existing production database: mark `0000_baseline` applied (below) before `db:migrate`. `db:migrate` refuses to run when `users` exists and the baseline row is missing, so `CREATE TABLE` is not replayed.
- Seed is non-destructive for user tables. Rebuild curriculum carefully; prefer import scripts over wiping users.
- Session expiry cleanup: cron route protected by `CRON_SECRET` (see Vercel cron config).

#### Mark the baseline on production (once)

`0000_baseline.sql` is the drizzle-kit snapshot of `db/schema.ts`. Production already has tables, so the migration must not be executed there. `db:baseline` inserts the journal row drizzle-orm would have written, and nothing else.

drizzle-orm skips a migration when the latest `__drizzle_migrations.created_at` is **greater than or equal** to that migration's journal `when` (`created_at < when` is the condition that runs SQL). The script sets `created_at` to `0000_baseline`'s `when` and `hash` to sha256 of the raw SQL file — the same values `readMigrationFiles` uses.

This command was not run against production from the migration PR. Run it once, from a network that can reach Turso:

```bash
# Dry-run. Prints tag, created_at, and hash. Does not connect, even if DATABASE_URL is set.
pnpm --filter web db:baseline

# Write the journal row on production. Requires both flags. Does not execute 0000_baseline.sql.
cd apps/web
export DATABASE_URL='libsql://…'          # Turso URL
export DATABASE_AUTH_TOKEN='…'            # never commit; the script does not print it
pnpm db:baseline -- --apply --allow-remote

# Later migrations only. 0000 is skipped.
pnpm db:migrate
```

The script aborts unless the 12 tables the push-era `db/seed.sql` created already exist, so an empty database is not stamped (use `db:migrate` there). It refuses a remote URL unless `--apply --allow-remote` are both present, and it opens no connection on a dry-run. The current `db/seed.sql` is content upserts only and does not create those tables.

Stamping does **not** create objects that are in `db/schema.ts` but were absent from the push-era seed DDL (`oauth_accounts`, nullable `users.password_hash`, `users_email_unique`, and the secondary indexes). Those differences are listed on the B6 PR. `db:generate` will not emit them again while they remain in the `0000` snapshot; a follow-up migration has to add whichever of them production is missing.

A local file left over from `db:push` can be stamped with `pnpm --filter web db:baseline -- --apply` (no `--allow-remote`), or deleted with `pnpm --filter web db:fresh`. `pnpm dev` stamps a complete local file automatically before migrating.

### Monitoring

- Vercel deployment logs + Runtime Logs for `/api/*` errors.
- Vercel Analytics / Speed Insights on the site (aggregate).
- First-party events/vitals when user opts in (Settings).

### Rollback

1. In Vercel → Deployments → promote previous successful production deployment.
2. If a bad DB migration was applied, restore from Turso backup / prior dump — do not “fix” with a destructive seed on production user data.
3. Confirm env vars unchanged after rollback.

### Common ops tasks

| Task | Action |
|------|--------|
| Make admin | `UPDATE users SET role='admin' WHERE email='…'` in Turso |
| Roll out curriculum content | Dump locally, back up Turso, dry-run `db:remote`, then `--apply --backup-done` (`docs/ENV.md`). Upserts content ids only. Does not touch games or accounts. |
| Rotate session secret | Set new `SESSION_TOKEN_SECRET`; existing PvP seats invalidate |
| Disable Google button | Unset `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |

## Support runbook

**Contact:** [iamshailesh121@gmail.com](mailto:iamshailesh121@gmail.com)  
**Public page:** [/support](https://chess-school.in/support)  
**FAQ:** [/#faq](https://chess-school.in/#faq)

### Common issues

| Issue | Guidance |
|-------|----------|
| Progress missing after login | Guest progress merges on enroll; ensure same account. Refresh; check Settings → sync. |
| Cannot password-login | Google-only accounts have no password — use Continue with Google or contact for help. |
| Google sign-in fails | Confirm redirect URI and `NEXT_PUBLIC_APP_URL`; try email register instead. |
| Guest wants to save progress | Complete enroll after first lesson (M-057 prompt) or Register from profile. |
| Delete account | Account screen in app, or email contact; see `/privacy`. |
| Online game won’t sync | Both players must be signed in; share code expires; Ably optional (polling fallback). |

### Escalation

Owner-operated product — all support mail goes to the contact above. No SLA; reply when available. Security issues: same inbox, mark subject `[security]`.

## Verification checklist

- [ ] Go-live + ops + support sections complete in this file
- [ ] `docs/ENV.md` lists web + mobile env vars
- [ ] `/about`, `/support`, `/terms` render with correct H1s
- [ ] Footer links About / Support / Terms / Privacy
- [ ] Sitemap + e2e + lighthouse + SEO script include new routes
- [x] Owner approval → Verified → merge to `main`

## Out of scope

- Native App Store / Play Store (M-049–M-053)
- Landing redesign, pricing page
- Changing production env (owner executes checklist)
