# 🎓 ChessSchool — Become a stronger player

A **school-first** chess academy PWA. Enroll, graduate through classes and
semesters, master openings and endgames, play adaptive bots, and review every
game move-by-move. **Guest-only, zero login, no backend, offline-first,
local-first.** Original brand, art, and sound.

> Evolved from the earlier "DuoChess" game-first build into an academy
> experience. This is a complete, runnable slice — build, typecheck, lint, unit
> + e2e tests, and Lighthouse are all green. Some systems are seeded to scale
> (see **Known limitations & roadmap**).

---

## 📊 Lighthouse (mobile, simulated) & budgets

| Category | Score |
| --- | --- |
| Performance | **95** |
| Accessibility | **100** |
| Best Practices | **100** |

FCP 0.8s · TBT 10ms · LCP ~2.6s · CLS ~0.10. Initial JS on `/` stays under the
**250 KB gzip** budget (chess.js / board / engine load only on `/play`,
`/lesson`, `/review/[id]`).

---

## ✨ What's new in the ChessSchool direction

**School system** — School → Semester → Class → Lesson hierarchy. Classes unlock
sequentially, each has its **own progress bar that resets per class**, and you
can **test out of a class by passing its exam**. Completing a class triggers a
**graduation ceremony**; the 🎓 badge in the top bar counts graduated classes.

**No questionnaires** — every lesson follows Learn → **Observe** (auto-played
example line) → **Try** (find the move) → Master. Openings (Italian, Ruy Lopez,
Sicilian) are taught move-by-move on the board.

**Hearts removed** — no lives/punishment. Progress is academic: mastery,
consistency, graduation. (v1→v2 store migration drops heart fields, preserves XP.)

**Focus-mode matches** — `/play` shows a pre-match chooser (vs Bot / Pass & Play).
Starting a match enters an **immersive board-first view** with the nav hidden and
a **top action bar** (Resign · Flip · Share). You **cannot** start a new game
mid-match — only resign or finish.

**Game persistence** — the active match (FEN + PGN + mode) is saved to
localStorage every move and **restored on refresh**; a `beforeunload` guard warns
before leaving an unfinished game.

**Match review** — finished games are saved to IndexedDB and listed in **Review**
with win/loss/draw/resigned badges. Open any game for a full **replay** (play /
pause / scrub / jump / move-list) ending in a **"How the checkmate happened"**
analysis — the mated king, the attacker's path (red arrows), every covered
escape square, a back-rank/diagonal/general pattern classifier, and a
"what could have prevented this?" tip.

**Theme Academy** — 8 board themes (Classic, Chalkboard, Marble, Tournament,
Wooden, Neon, Paper, Midnight) + 4 school themes (Elementary, High School,
University, Graduation) that retint the brand — all switch instantly.

**Install prompt** — appears once on load (after `beforeinstallprompt`), is
**dismissable**, and never returns once dismissed/installed (persisted).

**Audio overhaul** — warmer procedural synthesis: detuned dual-oscillator voices,
per-voice lowpass, a feedback-delay "space" bus, and ceremony cues (promotion,
unlock, exam, graduation, victory, ambience).

**Brand** — renamed **ChessSchool**; mascot replaced by an **academic crest**
(graduation cap over an open book); regenerated icons/manifest.

---

## 🧭 Migration notes (DuoChess → ChessSchool)

- **Settings store** `duochess.settings` v1→**v2**: adds `schoolTheme`; legacy
  board themes (`violet`/`slate`/`forest`) still resolve. Migrated, non-breaking.
- **Progression store** `duochess.progression` v1→**v2**: removes `hearts`,
  `maxHearts`, `heartsUpdatedAt`; adds `graduatedClasses`. **XP, streak, mastery,
  achievements, and weaknesses are preserved.**
- **New stores:** `chessschool.activematch` (active game) and
  `chessschool.install.dismissed` (install banner).
- **IndexedDB** `duochess` bumped to **v2** (`games` gains review fields:
  `endReason`, `winner`, `moveCount`, `elo`, `durationMs`, `createdAt`). Old rows
  remain readable.
- Persisted DB/localStorage keys keep the `duochess` name to avoid wiping
  existing local data on upgrade.

---

## 🏗 Architecture changes

No rebuild — the domain-driven, feature-based structure was extended, not
replaced. New modules:

```
core/
 ├ store/match.store.ts      active-match persistence (resume/refresh)
 ├ themes/themes.ts          Theme Academy registry + applyTheme()
features/
 ├ school/structure.ts       Semester → Class hierarchy + unlock/graduation logic
 ├ school/CampusMap.tsx       campus UI (class cards, progress, exams)
 ├ play/MatchView.tsx         unified live match (bot + pass), focus, persistence
 ├ play/MatchChooser.tsx      pre-match mode/ELO selection
 ├ review/replay.ts           PGN → frames + checkmate analysis (attackers/escapes)
 └ review/GameReplay.tsx      replay scrubber + "how checkmate happened"
app/
 └ review/[id]/page.tsx       per-game replay route
```

Retired: `features/play/BotGame.tsx`, `PassPlay.tsx`, `features/lessons/LessonMap.tsx`,
`components/ui/Hearts.tsx` (replaced by the above). The `Mascot` component name is
kept but now renders the academic crest.

Data flow is unchanged: UI → `ChessEngine` (chess.js wrapper) → stores → audio /
haptics / coach. Render-time reads derive from `fen`/store state, never mutable
refs (lint-enforced).

---

## 📸 Screenshots

`screenshots/` (mobile 390×844, from the production build):

| Campus map | Lesson (observe/try) | Focus match |
| --- | --- | --- |
| `01-campus.png` | `02-lesson.png` | `07-focus-match.png` |

| Play chooser | Replay + mate analysis | Settings (themes) |
| --- | --- | --- |
| `03-play-chooser.png` | `08-replay-mate.png` | `06-settings.png` |

---

## ⚡ Performance impact

- Routes grew from 18 → **22** (added `/review/[id]`, more lessons). Build stays
  ~1.4s (Turbopack); home initial JS still under the 250 KB gzip budget.
- Lighthouse **improved**: Performance 91→**95**, Accessibility 100, BP 100 —
  driven by removing the mount-gated map, slide-only entrances, and AA-safe colors.
- Bot still runs on the main thread via a deferred timeout (smooth at default
  depths); Web Worker remains the next perf step.

---

## 🚀 Run / test / deploy

```bash
pnpm install
pnpm dev                 # http://localhost:3000

pnpm build && pnpm start # production
pnpm typecheck           # strict TS
pnpm lint                # eslint (next + react-hooks)
pnpm test                # vitest (16 unit tests)
pnpm e2e                 # playwright (system Chrome: channel "chrome")
pnpm gen:icons           # regenerate PWA icons from public/icons/icon.svg
```

**Install:** desktop Chrome/Edge address-bar icon or the in-app banner; Android
Chrome → *Install app*; iOS Safari → Share → *Add to Home Screen*. Runs
standalone and fully offline. **Deploy:** `vercel --prod` (zero config, no env).

---

## ⚠️ Known limitations & roadmap (honest)

Implemented this wave: school hierarchy + campus, exams/graduation, observe-based
lessons incl. 3 openings, hearts removal, focus-mode matches with persistence +
resign + beforeunload, full match review with replay + checkmate analysis, 8
board themes, install-once prompt, audio overhaul, rebrand.

**Deferred to the next wave (documented, not blocked on architecture):**

1. **Study Plan system (#13)** — plan tiers (Casual→Competitive), daily routine
   (Warmup→Lesson→Practice→Match→Review→Reflection), learning calendar + study
   heatmap, adaptive rescheduling, performance dashboard, report cards &
   certificates, morning-assembly screen. The data model (mastery, streak,
   graduation, weaknesses) already supports it.
2. **~1000-day curriculum** — 11 lessons across 5 classes are authored & verified
   today; the engine scales to the full syllabus (French, Caro-Kann, QGD, KID,
   London, English; pawn structures; full endgames; thinking process). This is
   content authoring, not new code.
3. **Stockfish WASM** in a Web Worker (analysis + stronger play); move the JS bot
   off the main thread.
4. **Clocks/timeout** persistence for timed games; shareable game **links** (URL
   move serialization).
5. **Per-theme audio/motion packs**; certificate PDF export & graduation archive.
6. **Storybook** + visual regression; expand Playwright coverage.

---

## 🆕 Wave 2 — study systems & analytics

- **Study Plan (#13)** — Casual→Competitive tiers (+Custom), drives the daily XP
  goal; **daily routine** checklist (Warmup→Lesson→Practice→Match→Review→Reflection).
  `/plan`.
- **Recovery (#24)** — returning-user "welcome back, no penalties" catch-up card.
- **Learning Journal (#14 + #53)** — reflection capture (confidence + note) after
  lessons/matches → Dexie; `/journal` with growth summary & recurring mistakes.
- **Dashboard (#33/#36/#17/#45/#22)** — skill estimate, chess identity, 5-area
  **skill tree**, **Mistake DNA**, graduation forecast, **trophy room**. `/dashboard`.
- **Coach personalities (#25)** — Friendly/Strict/Mentor/Tactical/Minimal retint feedback.
- **Playground / Position Lab (#23/#16)** — sandbox: free play, undo, flip, hint,
  FEN load/copy. `/playground`.
- **Curriculum (#55)** — added **Endgame School** (opposition, promotion, K+Q mate),
  all FENs verified. 15 lessons / 6 classes / 4 semesters.
- **Performance (#54)** — opt-in diagnostics HUD (FPS/heap/route); routes lazy-split
  (home still ~236 KB gzip).

## 🆕 Wave 3 — premium UX & production trust

- **Learning-path breadcrumb + Resume card (#61/#64)** — home always shows
  *Semester › Class › Class N/total* and the single next action ("Continue learning").
- **Theme Studio (#59)** — `/themes` with **live preview** + mini-board swatches for
  all 8 board themes and 4 school themes; instant switch (no buried selects).
- **Error recovery (#75)** — `app/error.tsx` + `app/global-error.tsx` boundaries with
  Recover / Reload / Home — **no white screens**; errors logged locally only.
- **Export / Import + versioned storage (#72/#73)** — one-tap JSON backup
  (`chessschool-backup-YYYY-MM-DD.json`, schema-versioned) and validated import
  (rejects foreign/newer/corrupt files, #86).
- **Trust layer (#84)** — Settings → Your data shows *Saved · Offline ready · storage used*.
- **CSS hardening (#57)** — `min-w-0`/`truncate`/`shrink-0` on overflow-prone rows.
- **School Profile hub (#58/#66)** — Profile links Dashboard/Plan/Journal/Themes/
  Playground/Settings; settings reorganized; themes moved to Theme Studio.

### Migration (v2 → v3)
- Settings store gains `coachPersonality`, `diagnostics` (shallow-merge defaults — no
  data loss). New stores: `chessschool.plan`. Dexie **v3** adds the `journal` table.
- Backup files are schema-stamped (`schema: 3`); import refuses anything newer.
- All earlier keys/data preserved; XP, streak, mastery, graduations, history intact.

---

## 🆕 Wave 4 — journey learning & theme system V2

- **Learn → Journey (#96/#97)** — tapping a class now opens a **milestone path**
  (`/class/[id]`): a connected, animated journey of lesson nodes (completed /
  active-pulsing / locked / exam) with a subject header (icon, lessons, time
  estimate, mastery) and a centered "Start/Continue journey" CTA. No more folders.
  Campus → Class → **Journey** → Lesson.
- **Continue Learning (#98)** — the lesson-complete screen leads with a prominent
  **Continue learning →** (next lesson across the class/exam/next-class chain),
  with "Back to campus" + "Reflect" as secondary actions (#99 hierarchy).
- **App color themes incl. dark mode (#104/#106)** — Theme Studio gains an **App
  theme** row: Classic, School Blue, Forest, Ivory, Royal, and **Midnight (dark
  mode)** — recolors every surface/card/nav globally, instantly. Dark mode is
  AA-verified (ink contrast 6.5–15×; `brand-50` retinted so selected states stay
  legible).
- **Button/tap-target polish (#99/#100)** — `sm` buttons now 44px tall; buttons
  truncate gracefully and never wrap to a second row.
- **Board space (#102)** — lesson boards size to available height
  (`min(100%, 100dvh − 19rem)`) instead of a fixed small square.
- **Text/CSS hardening (#57/#110)** — `min-w-0`/`truncate`/`shrink-0` across class
  cards, review rows, journey nodes, resume card.

### Migration (v3 → v4)
- Settings store gains `appTheme` (shallow-merge default `"default"` — no data
  loss, no version bump needed). No store/DB schema changes; all saves intact.

---

## 🎨 Premium Design System — Phase 1 (foundation)

The first phase of a 6-phase premium-UX program. **Touches every screen, pure
presentation — no logic/data/PWA changes.**

- **Original SVG icon system** (`components/ui/Icon.tsx`) — 28 brand-matched,
  rounded, duotone-capable icons that theme automatically (light/dark/app).
  Replaces emoji in the bottom nav, top bar, profile hub, stat tiles, dashboard
  headers, and action buttons. (Emoji kept only where genuinely illustrative —
  per-lesson/class glyphs.)
- **Layered elevation tokens** — `--elev-1/2/3` (ambient + key light, single
  source) replace flat single shadows for real depth.
- **Animated numbers** (`AnimatedNumber`) — XP/level/streak/skill-estimate/trophy
  counts ease up with **tabular figures**; respects reduced-motion.
- **Toast system** (`Toaster` + `toast()`) — spring-in, auto-dismiss notifications
  replace silent state changes (export, copy, save, share). Validated in-browser.
- **Dynamic `theme-color`** — the device status bar / PWA chrome now matches the
  active app theme (dark in Midnight).
- **Animated nav** — active tab icon springs + switches to duotone.

Phase 1 stays within budget: home initial JS **248 KB gzip** (Toaster/Diagnostics
lazy-loaded out of the initial chunk); Lighthouse **94 / 100 / 100**.

**Phases 2–6 (planned, in priority order):** ② shared-element + route transitions
· ③ achievement-unlock takeover + designed dialogs (replace native `confirm`) ·
④ Student ID card + rank/title identity · ⑤ dashboard data-viz (radar + streak
heatmap) · ⑥ onboarding flow. Plus: original premium piece set, responsive
tablet/desktop layouts, hero animated-SVG/Lottie moments.

---

## 🎬 Phase 2 — motion + 🧱 content constants layer

**Motion (Phase 2):**
- **Route transitions** (`app/template.tsx`) — a subtle opacity cross-fade on every
  client navigation. Skips the first paint (so LCP isn't delayed) and is
  opacity-only (so it never disturbs sticky chrome). Reliable in App Router.
- (True cross-route shared-element morphs remain deferred — an App Router +
  perf-budget constraint; documented for a later pass.)

**Content layer (`content/`) — backend-swappable constants:**
- All curriculum **data** now lives in `content/lessons.ts` (lessons) and
  `content/school.ts` (stages → semesters → classes → units). These are pure
  constants in the exact shape a future backend/API would return.
- `features/lessons/curriculum.ts` and `features/school/structure.ts` are now thin
  **logic-only** adapters over the content layer (helpers + queries). Zero
  behavior change; all existing imports preserved.
- The full **academic ladder** (Elementary → Middle → High School → University →
  Master, the 20-class scope) is represented as constants; populated stages show
  real verified classes, later stages show roadmap teasers.
- Added a verified **Advanced Tactics** class (Pin, Skewer, Discovered Attack) to
  reduce repetition. **18 lessons / 7 classes** today, all FEN-verified.

> **Scaling to 1,200–1,800 lessons:** the architecture is now ready for it — the
> content layer is the single, typed, backend-swappable source. Authoring +
> *verifying* that volume by hand isn't feasible; the realistic path is a content
> pipeline (e.g. importing a puzzle database) that emits the same `Lesson[]` /
> `Semester[]` shapes. The app already consumes them.

---

## 🔐 Full-stack: accounts + database + 1,610 lessons

ChessSchool now has a real backend (local-first; hosts on serverless later).

**Stack:** Next.js Server Actions + **Drizzle ORM** + **SQLite** (`better-sqlite3`
locally → Turso/Postgres when hosting) · session auth (bcrypt + httpOnly cookies)
· `db/` schema · `lib/auth*` · `content/` constants.

**What works end-to-end (verified in-browser):**
- **Register / Log in / Log out** — DB-backed users + sessions; passwords bcrypt-hashed.
- **Student ID card** (`/account`) — issues a student number (`CS-2026-#####`),
  rank, enrollment date, and shows your **user-specific** XP/streak/classes.
- **Lesson Library** (`/library`) — browse **1,610 generated, FEN-verified lessons**
  across **54 classes / 5 semesters**; open any lesson and play it with the coach.
- Guest mode is untouched — accounts are optional and additive.

**The 1,610 lessons** are produced by `scripts/seed.mjs`: a generator that creates
captures, forcing checks, promotions, back-rank mates, and the famous openings —
**every position/move validated with chess.js before it's written** (a 200-lesson
random audit found 0 invalid). Re-run anytime; tune counts in the script. Content
lives in the DB so it's editable later via an admin UI / API with no app changes.

The DB driver is **dual-mode (libSQL)**: no env → local SQLite file; a
`libsql://…` `DATABASE_URL` → **Turso** (edge). *Same app code in both.*

### One command
```bash
pnpm install
pnpm dev          # sets up the DB on first run, then starts FE + BE together
```

### Dev database commands
```bash
pnpm db:push      # create/update tables from db/schema.ts
pnpm db:seed      # generate + insert the ~1,610 verified lessons
pnpm db:reset     # delete the local SQLite file (start fresh)
pnpm db:fresh     # reset + push + seed  ← rebuild everything
pnpm db:studio    # inspect data in Drizzle Studio (set role=admin here)
```

### Admin dashboard (`/admin`)
Role-gated curriculum CMS: add semesters / classes / **lessons** — every lesson's
FEN + move is **validated with chess.js** before saving, and appears in `/library`
instantly. Make yourself admin: register, then in `pnpm db:studio` set your
`users.role` to `admin`.

### Deploy to Vercel + Turso (usage-based, scale-to-zero)
```bash
# 1. Turso DB
turso db create chessschool
export DATABASE_URL=$(turso db show --url chessschool)
export DATABASE_AUTH_TOKEN=$(turso db tokens create chessschool)
# 2. Create schema + seed the remote DB (same scripts, env-driven)
pnpm db:push        # → pushes to Turso (dialect auto-switches)
pnpm db:seed        # → inserts the 1,610 lessons into Turso
# 3. Vercel: import the repo, set env DATABASE_URL + DATABASE_AUTH_TOKEN, deploy.
```
For a persistent-disk host instead (keeps the file DB), the **Dockerfile** runs
anywhere (Railway/Render/Fly) — mount a volume at `/app/data`.

---

## ✅ Production Readiness Report

| Area | Status | Evidence |
| --- | --- | --- |
| Build | ✅ | Turbopack, 36 routes, green |
| Types | ✅ | `tsc --noEmit` clean (strict) |
| Lint | ✅ | eslint clean (next + react-hooks + react-compiler) |
| Unit tests | ✅ | 19 passing (engine, bot, curriculum, backup) |
| E2E | ✅ | 9 Playwright specs incl. move→bot, journey, themes/dark-mode, dashboard |
| Performance | ✅ | Lighthouse **94–95** · FCP 0.8s · TBT 10–30ms · home JS ~236 KB gzip |
| Accessibility | ✅ | Lighthouse **100**; dark mode AA-verified (contrast 6.5–15×) |
| Best practices | ✅ | Lighthouse **100** |
| Offline / PWA | ✅ | SW precache + runtime cache; install-once prompt; offline route |
| Persistence | ✅ | active match restored on refresh (validated); journal/games in IndexedDB |
| Recovery | ✅ | route + global error boundaries; export/import; reset |
| Data ownership | ✅ | versioned JSON export/import with validation |

**Known risks:** bot search runs on the main thread (smooth at default depths, Web
Worker is the planned fix); curriculum is 15 lessons (engine scales to the full
syllabus — authoring work); Storybook/visual-regression not yet wired.

## 🗺 Deferred systems roadmap (honest)

The Wave-3/4 briefs (#56–#95) describe ~40 further systems — a multi-month program.
Implemented above are the highest-leverage pieces (the explicit UX pain points +
error recovery + data export/trust). Remaining, grouped & prioritized:

1. **Design-system V2 & motion polish (#56/#68)**, container-query responsive pass,
   premium empty states (#67).
2. **Curriculum depth (#55/#60/#63)** — Unit/Section hierarchy, expandable course
   cards, capstone matches, ~1000-day content; milestone timeline (#62).
3. **Onboarding V2 (#79)** — goal/experience/time/theme/coach → first-week plan.
4. **Global search ⌘K (#81)** + keyboard shortcuts (#82); progressive disclosure (#83).
5. **Save reliability (#71/#92)** snapshots + restore points; offline task queue (#76);
   idle background warming (#77); memory archival/compression (#85).
6. **Developer mode (#74)**, local observability (#87), release channels (#90),
   curriculum authoring studio (#91), visual-regression gates (#88/#89).
7. **Thinking Mode (#15)**, Match Commentary (#20), Opening Explorer (#27),
   Tournament Mode (#26), Shadow Opponent (#37), Story Mode (#31).

---

Built guest-first and local-first. Enjoy your studies. 🎓♟️
