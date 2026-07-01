@AGENTS.md

# ChessSchool — project guide

A premium, offline-capable **chess-learning PWA** structured like a school: students
graduate through Classes → Semesters → Stages, playing FEN-verified lessons and
matches. Deployed on Vercel + Turso (usage-based, scale-to-zero).

Live: https://chess-school-alpha.vercel.app · Repo: `Shailesh200/ChessSchool` (personal GitHub).

## Stack
- **Next.js 16** (App Router, Turbopack, async `params`, Server Actions, `force-dynamic`)
- **React 19** (strict react-hooks/react-compiler lint rules) · **Tailwind v4** (CSS `@theme` tokens in `app/globals.css`, no JS config)
- **Drizzle ORM** + **libSQL** (`@libsql/client`) — same code runs local SQLite file or Turso edge
- **chess.js** (move/FEN validation) · **react-chessboard v5** · **Framer Motion** · **Zustand** (persisted, `skipHydration`)
- Auth: **bcryptjs** + DB sessions + httpOnly cookies · Procedural **Web Audio** (no sample files) · hand-rolled service worker (`public/sw.js`)
- Tooling: ESLint, Prettier, Vitest (unit), Playwright (e2e, uses system Chrome `channel:"chrome"`)

## Content architecture (important)
The **DB is the single source of truth** for curriculum. Both surfaces read it:
- **Main experience** — Campus (`app/page.tsx`) → Journey (`app/class/[id]`) → Lesson (`app/lesson/[id]`) are **server components** that load via `features/school/catalog.server.ts` (`getCatalog()`), passing data to client components that overlay client-side progress.
- **Library** (`app/library/*`) — free-browse of all lessons. **Admin** (`app/admin`) writes to the DB → edits appear in both.

Curated curriculum data lives in `content/data/*.mjs` (plain JS so the Node **seeder** can import it). `content/school.ts` / `content/lessons.ts` add the TS types. `features/school/structure.ts` holds the school *logic* (unlock/graduation/progress), parameterized by the catalog with constants as a fallback.

Seeder (`scripts/seed.mjs`) loads **curated lessons + generated drills** → ~1,628 lessons / 61 classes / 9 semesters, every position validated with chess.js.

## Key directories
- `app/` — routes. `features/` — domain modules (school, lessons, play, board, chess-engine, coaching…). `components/` — UI + layout + providers.
- `core/` — stores (`store/*.store.ts`, Zustand), audio, haptics, pwa, themes, db (Dexie/IndexedDB for saved games).
- `db/` — Drizzle schema + dual-mode client + `seed.sql` (committed dump). `lib/` — server actions (auth, admin, profile).

## Commands
```
pnpm dev            # ensure-db + next dev (Turbopack)
pnpm build / start  # production
pnpm typecheck | lint | test | e2e
pnpm db:fresh       # reset + push schema + seed (local)
pnpm db:dump        # regenerate db/seed.sql from local.db
pnpm db:remote      # seed a REMOTE Turso DB from db/seed.sql (non-destructive — keeps users)
pnpm db:remote-clean  # ⚠️ DESTRUCTIVE: wipes ALL users + reseeds (needs CONFIRM=WIPE) — testing only
```

`scripts/seed.mjs` now seeds only the **hand-authored base** (Foundations, Opening
School/Theory, Tactics Lab, Endgame School, Famous Mates, Immortal Games ≈ 53 lessons).
The auto-generated drill semesters were **retired**; the premium puzzle bulk comes from
the Lichess import below.

### Our curated puzzle set (hybrid plan)
The bulk of puzzles are sourced from the open **Lichess puzzle DB** (CC0; real
games, rated, themed) but packaged as **our own committed dataset**:
`data/chess-school-puzzles.csv.gz` — a quality-filtered, balanced spread across our
stage×concept matrix (~a few MB, in the repo). After the one-time build, seeding
needs **no 300 MB download and no external tools** (gzip is built into Node).

One-time build (off-network — the office proxy 403s database.lichess.org):
```
curl -L -o lichess_db_puzzle.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
pnpm db:build-puzzles lichess_db_puzzle.csv.zst    # → data/chess-school-puzzles.csv.gz (commit it)
```
Seed from our committed set (no args = reads `data/chess-school-puzzles.csv.gz`):
```
pnpm install && pnpm db:fresh        # create local.db (schema + base + fallback homework)
pnpm db:import-puzzles               # curriculum from our curated set (LIMIT=5200)
pnpm db:import-homework              # SEPARATE homework pool (disjoint slice, concept-tagged)
pnpm db:dump && pnpm db:remote
```
Phase 2 (planned): personalized puzzles generated from users' own Mistake-DNA
positions + saved games, verified with the in-app Stockfish.
`scripts/import-lichess.mjs` buckets puzzles by school stage (← rating) × concept (←
theme), gives each class a hand-authored tutorial + ~18 puzzles, converts multi-move
solutions into multi-step lessons, and chess.js-validates every line (ids prefixed
`pz-`). Re-running replaces the `pz-` set and leaves seed.mjs content intact.

## Database
- Local: `DATABASE_URL` unset → `file:local.db`. Remote: `DATABASE_URL=libsql://…` + `DATABASE_AUTH_TOKEN`.
- `db/seed.sql` is **non-destructive**: it DROP+CREATE+INSERTs the content tables (`semesters`, `classes`, `lessons`) but uses `CREATE TABLE IF NOT EXISTS` for auth tables — re-seeding **preserves user accounts**.
- Schema lives in `db/schema.ts` (users, sessions, profiles, progress, lessonRecords, semesters, classes, lessons). Lesson `steps` are JSON text.

## Realtime (online PvP)
Online games use **optimistic moves + adaptive polling** by default. For instant
push, set **`ABLY_API_KEY`** (Ably free tier) in Vercel + `.env`: the server
publishes each move to `game:<id>` and clients subscribe (token-auth via
`/api/ably-token`, subscribe-only). With no key, `/api/ably-token` 503s and clients
silently fall back to polling — nothing breaks.

## Deployment
- **Vercel** auto-deploys `main` via Git integration. **Monorepo:** set Project → Settings → General → **Root Directory** to `apps/web` (required after merging the monorepo branch). `apps/web/vercel.json` installs from the workspace root.
- Env vars (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`) live in Vercel only. CI (`.github/workflows/ci.yml`) runs typecheck/lint/test/build + e2e.
- **Make an admin**: register on the live site, then run `UPDATE users SET role='admin' WHERE email='…'` via the Turso web SQL console (app.turso.tech) or `turso db shell` off-network.

## Corporate-network caveat (this machine)
The office proxy **resets connections to the Turso DB endpoint** (`*.turso.io`) and Vercel CLI — so **seed/provision from a personal network** (home wifi / hotspot). Turso *auth/management* and GitHub push (SSH `github-personal`) work fine from the office. Node tools that must do TLS may need `NODE_EXTRA_CA_CERTS=/tmp/corp-ca.pem`.

## Git identity
Personal account only. Remote: `git@github-personal:Shailesh200/ChessSchool.git`. Commit email `iamshailesh121@gmail.com`. Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Conventions
- Match surrounding code; keep comment density/idiom. Derive render values from state (no ref access during render, no setState-in-effect) to satisfy react-compiler lint.
- Above-the-fold content must paint without opacity gates (LCP). Persisted stores use `skipHydration` + rehydrate in `ClientProviders`.
- Original assets only (SVG icons in `components/ui/Icon.tsx`, procedural audio) — no third-party icon fonts or Duolingo-derived art.

## Status / backlog
Done: hosted PWA, accounts + Student ID + onboarding, DB-driven curriculum (1,628 lessons), admin CMS, play vs bot / pass & play with **clock + material + promotion choice**, review/replay, in-house dialogs, app-update toast.
Pending (next batches): **gameplay progress → account sync** (biggest gap — progress is client-local), **guest→account enroll prompt** after first lesson, Google OAuth, admin custom dropdowns + **import (JSON)**, nav-button loaders, broader exam-to-skip, Stockfish WASM, dashboard radar/heatmap, piece themes, responsive desktop.
