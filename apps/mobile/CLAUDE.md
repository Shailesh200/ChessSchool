# ChessSchool Mobile — Project Guide (`apps/mobile`)

Native **React Native (Expo) app** for ChessSchool, built for **full feature + UI/UX parity** with the web PWA (`apps/web`). Same monorepo, shared chess/bot/achievements logic in `packages/core`. The USP is the teaching UX and lessons — the app mirrors web's behaviour, not just its screens.

> New here? Read this file, then `../../CODE_REVIEW.md` (known issues), then `DELIVERY_REPORT.md` (what's built). The root `../../CLAUDE.md` covers the web app + DB/curriculum.

---

## 1. Stack
- **Expo SDK 54**, **Expo Router 6** (file-based routing in `app/`), React 19, React Native 0.81.
- `react-native-svg` (board, pieces, icons, charts), `expo-linear-gradient` (ID card), `expo-secure-store` (token), `expo-audio` (sfx), `expo-haptics`, `@expo-google-fonts/fredoka` (brand font).
- **No Redux** — small external stores via `useSyncExternalStore` (`settings`, `progressStore`) + React context (`auth`).
- TypeScript strict. `@/*` path alias → `src/*` (see `tsconfig.json`). `app.json` has `typedRoutes` **off** (new routes broke tsc).

## 2. Backend
The app has **no server of its own** — it calls the production Next.js API at `https://chess-school-alpha.vercel.app` (Turso-backed, 16k+ lessons). The base URL is `EXPO_PUBLIC_API_URL` (bundle-time inlined — change requires `expo start -c` / re-export). All requests go through `src/api.ts` → `api<T>(path, {method, body})`, which attaches the Bearer token and throws `ApiError(status, message)` on non-2xx. A 401 **with a token** clears it and triggers re-auth (guests, who have no token, are not bounced).

Auth: token-based. `/api/auth/{login,register,me,logout}` return a token; the web `getApiUser(req)` checks Bearer then cookie, so web keeps working. **Guest mode**: `auth.continueAsGuest()` sets a local guest user (no token) — browses public endpoints (campus/lessons), progress is best-effort.

## 3. Commands
```bash
pnpm --filter mobile start         # expo start (press w=web, i=iOS, a=Android)
pnpm --filter mobile typecheck     # tsc --noEmit
pnpm --filter mobile test          # vitest run (unit, pure logic)
pnpm --filter mobile test:coverage # vitest run --coverage
npx expo export --platform web --output-dir dist   # static web build (used by the parity harness)
```

## 4. Architecture & key modules (`src/`)
- **`api.ts`** — fetch helper, token storage (SecureStore native / localStorage web), `ApiError`, `setUnauthorizedHandler`.
- **`auth.tsx`** — `AuthProvider` + `useAuth()`. State: `user`, `guest`, `loading`, `needsOnboarding`. Actions: `login/register/logout/continueAsGuest/finishOnboarding`. Registers the 401 handler.
- **`progressStore.ts`** — single cached `/api/progress` snapshot (`useProgress()`), shared across all screens (TopBar/Learn/Profile/Review/Dashboard/Homework). **`mutateProgress(fn)`** = serialized read-modify-write queue; ALL progress writes go through it so concurrent writers can't clobber. Cleared on auth change.
- **`progression.ts`** — pure reducers ported 1:1 from web's Zustand stores: `awardXp`, `recordLesson` (mastery EWMA), `registerActivity` (streak), `updateRating` (Elo K=32), `logMistake`, `recordWeakness`, `applyLessonComplete`, `applyMatchEnd`. **This is the behavioural core** — web computes progression client-side, so the app must too (apply, then POST).
- **`progress-utils.ts`** — `levelForXp`, `xpProgress`, `rankForClasses`.
- **`settings.ts`** — external store, persisted (SecureStore/localStorage) **and** synced per-user to the account (`progress.data.settings`, debounced via `mutateProgress`). `BOARD_THEMES` (8 + 2 legacy aliases), `SELECTABLE_BOARD_THEMES`, `BOARD_THEME_NAMES`. Theme fields + learning prefs.
- **`ChessBoard.tsx`** — SVG board. **Tap-to-move AND drag-to-move** (board-level `PanResponder`: a drag drops to move with a finger-following ghost; a tap selects/moves). Post-drag slide is suppressed (no double-animation). Animated piece slide = 220ms ease-out (matches web's tween). Reads `boardTheme`/`pieceTheme`/`reducedMotion` from settings. Move sounds via `sfx`.
- **`Piece.tsx`** — 7 piece themes (classic/marble/crystal/neon/forest/ocean/blossom), `PIECE_THEMES`, `getPieceTheme`.
- **`sfx.ts`** — plays `assets/sounds/*.wav` (move/capture/select/success/error/win) via expo-audio; **the wavs are offline-rendered from web's exact `audioEngine.ts` voice recipes** (`/tmp/synth.mjs` script in history) so native audio matches the web PWA. Respects `sound`/`volume` settings. (Web export is silent — `Platform.OS==="web"` returns early.)
- **`haptics.ts`** — tap/success/error (expo-haptics).
- **`Cody.tsx`** — coach mascot (SVG, expressions: wave/think/cheer/sad/happy). **`Icon.tsx`** — in-house SVG icon set. **`Confetti.tsx`** — celebration. **`TopBar.tsx`** — streak/level/graduated bar (animated fill, reads the cache). **`BackButton.tsx`**, **`Slider.tsx`** (flicker-free: local drag value + stepped emits + pointer-transparent children), **`CampusMap.tsx`** (stages→semesters→classes accordion + school-exam + load-more).

## 5. Routes (`app/`)
`_layout.tsx` = `AuthProvider` + a **Gate**: no user → `/login`; new user → `/onboarding`; else tabs.
- **Tabs** (`(tabs)/`): `index` (Learn — greeting, placement card, resume, homework banner, daily goal, CampusMap), `play` (match setup: vs Bot strength/time, vs Human), `review` (match history), `profile` (Student ID, hub grid, stat tiles, learning-profile→dashboard, achievements).
- **Lessons**: `lesson/[id]` (coach bubble, board with arrows/highlights, turn indicator, correct/wrong animation, completion card; `?hw=<step>` → homework-specific completion). `class/[id]` (journey path). `classes`, `stage/[id]`, `library`.
- **Play**: `play/game` (vs Bot — centered board, turn dot, rewind/forward), `play/pass` (pass & play vs Human — player bars, resign), `play/online/index` (lobby: create/join code), `play/online/[id]` (live game, polling sync, clocks, resign).
- **Other**: `onboarding` (6-step wizard → distinct board theme), `placement` (8 puzzles → starting ELO, unlocks placed school), `exam/school/[stage]` (school exam → unlock next), `homework` (plan/pace/schedule/routine with Go + checkboxes), `journal` (mistakes), `dashboard` (skill radar + heatmap), `account` (Student ID), `themes` (live-preview board+piece picker), `settings`, `replay/[index]`, `login`.

## 6. Verification (no device loop)
The owner can't easily run device screenshots, so verification uses a **Playwright harness on the Expo web export**:
- `npx expo export --platform web --output-dir dist`, serve with a SPA-fallback server (deep routes need it — see `/tmp/spa_server.py` pattern in history), drive with `@playwright/test` (`channel:"chrome"`, `--disable-web-security` for prod CORS) at **393px** (iPhone 16 reference width), screenshot, compare to the logged-in web app (`apps/web/scripts/parity-shot.mjs`).
- **Online PvP** is verified with **two browser contexts** (white creates / black joins; a move syncs).
- Parity test account (prod): `parity-bot@duochess.dev` / `parity12345`.
- react-native-web is a faithful **layout** proxy; native-only behaviour (audio latency, haptics, true gesture feel) needs a device/simulator.

## 7. Deploying backend changes (IMPORTANT)
Production deploys from the **repo ROOT (old structure)** on branch **`main`** via Vercel. `apps/web` is the monorepo copy. To ship an *additive, web-safe* API change: `git worktree add -b deploy/x ~/duochess-hotfix origin/main`, copy the changed `apps/web` files onto the root structure, `cp apps/web/local.db`, then `pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm e2e` (must stay **9/9**), `git push origin deploy/x:main`. Mobile work lives on the **`monorepo`** branch (does NOT auto-deploy). Some app features (homeworkDone/placementDone persistence) need a `/api/progress` deploy to fully persist — until then they live in the local cache (work in-session).

## 8. Git
Personal account, remote `git@github-personal:Shailesh200/ChessSchool.git`. Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Commit/push only when asked; never push `monorepo` to `main`.

## 9. Conventions
Match surrounding code (clean: 0 `any`/`console.*`/TODO). Derive render values from state (no ref reads in render where avoidable — react-compiler lint). Original assets only (SVG + procedural audio). Tokens in `src/theme.ts` (`colors`, `radius`, `space`, `type`, `shadowCard`) — slightly larger type scale than web by request.

## 10. Known gaps / follow-ups
See `../../CODE_REVIEW.md`. Highlights: app-wide colour theming (dark mode / surface retint) is not built — onboarding theme currently maps to a board theme; per-screen error/retry on fetch failure is partial; web has CRITICAL items (unauthenticated online session; progress POST delete-all) that need a coordinated deploy + re-verify. Accessibility labels are not yet added. Time-control UI for bot games is cosmetic.
