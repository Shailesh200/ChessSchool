@AGENTS.md

# ChessSchool — project guide

A premium, offline-capable **chess-learning PWA** (+ companion Expo app) structured like a school: students graduate through Classes → Semesters → Stages via FEN-verified lessons, exams, homework, and matches. Deployed on Vercel + Turso (usage-based, scale-to-zero).

Live: https://chess-school.in · Repo: `Shailesh200/ChessSchool` (personal GitHub).

**Master plan:** [`plans/00_MASTER_DEVELOPMENT_PLAN.md`](plans/00_MASTER_DEVELOPMENT_PLAN.md) — milestone-driven roadmap. **Launch strategy: Web GA first** (native app store after M-073).

**Web GA** = public-ready **PWA** (installable, offline — M-010 ✓) + **browser view** (responsive desktop/tablet — M-059 ✓) + approved UI polish (M-075 ✓) + security/docs/QA gates (M-070 ✓, M-071 ✓, M-072 ✓, M-073 pending). Not the native App Store release (M-049–M-053).

## Stack
- **Next.js 16** (App Router, Turbopack, async `params`, Server Actions) — `apps/web`
- **Expo SDK 54** + Expo Router 6 — `apps/mobile`
- **React 19** · **Tailwind v4** (CSS `@theme` in `apps/web/app/globals.css`)
- **Drizzle ORM** + **libSQL** — local SQLite or Turso edge
- **chess.js** · **react-chessboard v5** (web) · custom SVG board (mobile)
- **Stockfish-18 WASM** in Web Worker (web analysis + strong bot)
- **Zustand** (persisted, `skipHydration`) · **`@chess-school/progression`** shared package
- Auth: **bcryptjs** + DB sessions (SHA-256 stored) + httpOnly cookies (web) · Bearer + SecureStore (mobile) · **Google OAuth** (M-056)
- Procedural **Web Audio** (no sample files) · hand-rolled service worker (`apps/web/public/sw.js`)
- Realtime PvP: **Ably** (optional) + polling fallback · seat tokens + authenticated moves (M-043)
- Monorepo: **pnpm** + **Turborepo** *(planned → Bun/Oxlint/Oxfmt/Lefthook in M-076)*
- Tooling: ESLint, Prettier, Vitest, Playwright e2e (`channel:"chrome"`)

## Monorepo layout
```
apps/web/          Next.js PWA (production — Vercel root: apps/web)
apps/mobile/       Expo native app
packages/core/     @chess-school/core — engine, bot, types
packages/progression/  @chess-school/progression — XP, streak, mastery reducers
data/              chess-school-puzzles.csv.gz (Lichess import source)
plans/             Master development plan + milestone specs + ADRs
```

## Content architecture
The **DB is the single source of truth** for curriculum. Both web and mobile read it via API:
- **Main experience** — Campus → Journey (`/class/[id]`) → Lesson — server components load via `features/school/catalog.server.ts` (`getCatalog()`).
- **Library** (`/library`) — free-browse. **Admin** (`/admin`) writes to DB → edits appear everywhere.

Curated base in `apps/web/content/data/*.mjs`. Seeder `apps/web/scripts/seed.mjs` + Lichess import `scripts/import-lichess.mjs` (~5k+ puzzles in committed `data/chess-school-puzzles.csv.gz`).

## Commands
```bash
pnpm dev              # web dev (ensure-db + Turbopack)
pnpm build            # turbo build all packages
pnpm typecheck | lint | test | e2e
pnpm verify:milestone # full gate: typecheck, lint, coverage≥90%, e2e, SEO, Lighthouse
pnpm --filter web storybook     # M-072 UI component catalog
pnpm --filter web db:fresh      # reset + push + seed local
pnpm --filter web db:import-puzzles
pnpm --filter web db:dump && pnpm --filter web db:remote
```

### Puzzle import (one-time build off-network if needed)
```bash
curl -L -o lichess_db_puzzle.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
pnpm --filter web db:build-puzzles lichess_db_puzzle.csv.zst
pnpm install && pnpm --filter web db:fresh
pnpm --filter web db:import-puzzles    # LIMIT=5200 default
pnpm --filter web db:import-homework
pnpm --filter web db:dump && pnpm --filter web db:remote
```

## Database
- Local: `DATABASE_URL` unset → `apps/web/local.db`
- Remote: `DATABASE_URL=libsql://…` + `DATABASE_AUTH_TOKEN`
- Schema: `apps/web/db/schema.ts` — users, oauth_accounts, sessions, profiles, progress, lessonRecords, semesters, classes, lessons, homeworkLessons, gameSessions, analytics_events, web_vitals
- `db/seed.sql` is **non-destructive** for user tables — re-seeding preserves accounts
- After schema changes (e.g. OAuth): `pnpm --filter web db:push` locally and against Turso

## Auth & accounts
- Email/password register + login; **Google sign-in** when OAuth env vars are set (web button + mobile token API)
- Google links to existing email account on first sign-in with same address
- Google-only accounts cannot use password login
- Guest mode: local progress only until enroll; **M-057** enroll prompt after first guest lesson

### Env vars (auth)
```bash
# Google OAuth (web + mobile token endpoint)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...   # same client ID — shows the sign-in button
EXPO_PUBLIC_GOOGLE_CLIENT_ID=...   # mobile Google Sign-In (EAS env / local .env)
NEXT_PUBLIC_APP_URL=https://chess-school.in   # or http://localhost:3000 locally
```
Redirect URI: `{APP_URL}/api/auth/google/callback` · Mobile profile: `GET /api/profile`, `POST /api/profile/onboarding`

## Progress sync
Logged-in users: `ProgressSync` pulls on login, debounced push to `/api/progress`. Guest mode preserved; merge on enroll. Server uses **transactional upsert + max-merge** (M-044). Mobile uses a serialized write queue to avoid client clobber.

## Security (M-043–M-048, M-070)
- PvP: authenticated seat ownership, HMAC seat tokens, CSPRNG game IDs, server-validated timeouts
- Sessions: SHA-256 token hash in DB; expiry cleanup cron (`CRON_SECRET`)
- Rate limiting on auth, progress, session, account, events, vitals, TTS (in-memory per instance — see `plans/M-070_SECURITY_AUDIT.md` for GA notes)
- CSP + security headers in `apps/web/next.config.ts`
- Privacy policy: `/privacy` (aligned with OAuth, analytics, TTS in M-070)
- Audit reference: `CODE_REVIEW.md` (historical) · `plans/M-070_SECURITY_AUDIT.md` (current)

## Realtime (online PvP)
Optimistic moves + adaptive polling by default. Set **`ABLY_API_KEY`** for instant push via `/api/ably-token`. Without key → 503 + silent polling fallback. **`SESSION_TOKEN_SECRET`** required in production for seat tokens.

## Deployment
- **Vercel** auto-deploys `main`. **Root Directory → `apps/web`** (required).
- Env: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, optional `ABLY_API_KEY`, `SESSION_TOKEN_SECRET`, `CRON_SECRET`, Google OAuth vars above. Coach TTS uses **Microsoft Edge Read Aloud** server-side (no API key). Optional `GOOGLE_TTS_CREDENTIALS` + `TTS_PROVIDER=google` if GCP billing is enabled.
- CI: `.github/workflows/ci.yml` — typecheck, lint, test, build, e2e
- **Make an admin:** register, then `UPDATE users SET role='admin' WHERE email='…'` in Turso console

## Mobile
- Parity backlog: **`apps/mobile/PARITY_GAPS.md`** (authoritative)
- Strategy: `apps/mobile/PLAN.md` · Release: `apps/mobile/RELEASE.md`
- `apps/mobile/PARITY.md` is **retired** (M-071) — do not update
- Store ship is **M-053**, after Web GA

## Corporate-network caveat (this machine)
Office proxy resets Turso/Vercel CLI TLS — seed/provision from personal network. GitHub SSH (`github-personal`) works from office. Node TLS may need `NODE_EXTRA_CA_CERTS=/tmp/corp-ca.pem`.

## Git identity
Remote: `git@github-personal:Shailesh200/ChessSchool.git`. Commit email `iamshailesh121@gmail.com`. Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Conventions
- Match surrounding code; react-compiler lint (no ref access during render, no setState-in-effect)
- LCP: above-the-fold without opacity gates. Persisted stores: `skipHydration` + rehydrate in `ClientProviders`
- Original assets only (SVG icons in `Icon.tsx`, procedural audio) — no third-party icon fonts
- **Milestones:** one branch per milestone (`milestone/M-###-slug`) → `pnpm verify:milestone` → owner approval → merge to `main`
- **New web routes/features:** add Playwright e2e + update `scripts/web-e2e-routes.json` and `scripts/web-lighthouse-routes.json`

## Milestone status (2026-07-12)
**Verified recently:** M-056 Google OAuth · M-057 guest enroll prompt · M-070 security audit · M-071 documentation refresh  
**Verified recently:** M-072 visual regression & Storybook  
**Next Web GA gate:** M-073 launch runbook  
**Post Web GA:** M-049–M-053 mobile store · M-058 personalized puzzles · M-060 global search · M-076 toolchain

**Done (summary):** hosted PWA, accounts + Student ID + Google OAuth, DB curriculum + Lichess import (~5k+ puzzles), admin CMS + JSON import, progress sync (hardened), Stockfish WASM, dashboard/journal/plan/homework, secure online PvP, responsive browser layouts, premium UI overhaul, mobile ~90% screen parity, shared progression package, production hardening M-043–M-048.
