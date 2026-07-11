@AGENTS.md

# ChessSchool — project guide

A premium, offline-capable **chess-learning PWA** (+ companion Expo app) structured like a school: students graduate through Classes → Semesters → Stages via FEN-verified lessons, exams, homework, and matches. Deployed on Vercel + Turso (usage-based, scale-to-zero).

Live: https://chess-school.in · Repo: `Shailesh200/ChessSchool` (personal GitHub).

**Master plan:** [`plans/00_MASTER_DEVELOPMENT_PLAN.md`](plans/00_MASTER_DEVELOPMENT_PLAN.md) — milestone-driven roadmap. **Launch strategy: Web GA first** (mobile store after M-073).

**Web GA** = public-ready **PWA** (installable, offline — M-010 done) + **browser view** (desktop/tablet responsive — M-059) + approved UI polish (M-075). Not the native app store.

## Stack
- **Next.js 16** (App Router, Turbopack, async `params`, Server Actions) — `apps/web`
- **Expo SDK 54** + Expo Router 6 — `apps/mobile`
- **React 19** · **Tailwind v4** (CSS `@theme` in `apps/web/app/globals.css`)
- **Drizzle ORM** + **libSQL** — local SQLite or Turso edge
- **chess.js** · **react-chessboard v5** (web) · custom SVG board (mobile)
- **Stockfish-18 WASM** in Web Worker (web analysis + strong bot)
- **Zustand** (persisted, `skipHydration`) · **`@chess-school/progression`** shared package
- Auth: **bcryptjs** + DB sessions + httpOnly cookies (web) · Bearer + SecureStore (mobile)
- Procedural **Web Audio** (no sample files) · hand-rolled service worker (`apps/web/public/sw.js`)
- Realtime PvP: **Ably** (optional) + polling fallback
- Monorepo: **pnpm** + **Turborepo** *(planned → Bun/Oxlint/Oxfmt/Lefthook in M-076)*
- Tooling: ESLint, Prettier, Vitest, Playwright e2e (`channel:"chrome"`)

## Monorepo layout
```
apps/web/          Next.js PWA (production — Vercel root: apps/web)
apps/mobile/       Expo native app
packages/core/     @chess-school/core — engine, bot, types
packages/progression/  @chess-school/progression — XP, streak, mastery reducers
data/              chess-school-puzzles.csv.gz (Lichess import source)
plans/             Master development plan + ADRs
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
- Schema: `apps/web/db/schema.ts` — users, sessions, profiles, progress, lessonRecords, semesters, classes, lessons, homeworkLessons, gameSessions
- `db/seed.sql` is **non-destructive** for user tables — re-seeding preserves accounts

## Progress sync
Logged-in users: `ProgressSync` pulls on login, debounced push to `/api/progress`. Guest mode preserved; merge toast on enroll.

**Known debt (M-044):** progress POST delete-all + last-write-wins on typed columns — see `CODE_REVIEW.md`.

## Realtime (online PvP)
Optimistic moves + adaptive polling by default. Set **`ABLY_API_KEY`** for instant push via `/api/ably-token`. Without key → 503 + silent polling fallback.

**Known debt (M-043):** seat ownership / auth on session moves — see `CODE_REVIEW.md` C1/C2.

## Deployment
- **Vercel** auto-deploys `main`. **Root Directory → `apps/web`** (required).
- Env: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, optional `ABLY_API_KEY`. Coach TTS uses **Microsoft Edge Read Aloud** server-side (no API key). Optional `GOOGLE_TTS_CREDENTIALS` + `TTS_PROVIDER=google` if GCP billing is enabled.
- CI: `.github/workflows/ci.yml` — typecheck, lint, test, build, e2e
- **Make an admin:** register, then `UPDATE users SET role='admin' WHERE email='…'` in Turso console

## Mobile
- Parity backlog: `apps/mobile/PARITY_GAPS.md` (authoritative — `PARITY.md` is stale)
- Release: `apps/mobile/RELEASE.md` · Store ship is **M-053**, after Web GA

## Corporate-network caveat (this machine)
Office proxy resets Turso/Vercel CLI TLS — seed/provision from personal network. GitHub SSH (`github-personal`) works from office.

## Git identity
Remote: `git@github-personal:Shailesh200/ChessSchool.git`. Commit email `iamshailesh121@gmail.com`.

## Conventions
- Match surrounding code; react-compiler lint (no ref access during render, no setState-in-effect)
- LCP: above-the-fold without opacity gates. Persisted stores: `skipHydration` + rehydrate in `ClientProviders`
- Original assets only (SVG icons in `Icon.tsx`, procedural audio) — no third-party icon fonts
- **Milestones:** one branch per milestone (`milestone/M-###-slug`) → `pnpm verify:milestone` → owner approval → merge to `main`
- **New web routes/features:** add Playwright e2e + update `scripts/web-e2e-routes.json` and `scripts/web-lighthouse-routes.json`

## Current milestone & backlog
**Current:** M-043 — Online PvP Security  
**Web GA path:** M-043–M-048 → M-063 → M-075 Phase A (wireframes — **owner approval**) → M-059 (browser) → M-075 Phase B → M-070–M-073 → launch  
**Post Web GA:** M-049–M-053 mobile store · M-076 toolchain · M-077–M-078 scaling  

Done: hosted PWA (M-010), accounts + Student ID, DB curriculum + Lichess import, admin CMS + JSON import, progress sync, Stockfish WASM, dashboard/journal/plan/homework, online PvP (foundation), mobile ~90% screen parity, shared progression package.

Pending (from master plan): progress API hardening, PvP seat auth, curriculum expansion, **wireframes/mockups for UI overhaul**, responsive browser layouts, UI implementation (post-approval), Google OAuth, guest enroll prompt, personalized puzzles, global search, native app store release.
