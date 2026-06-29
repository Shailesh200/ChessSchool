# ChessSchool Mobile — Delivery Report & Handoff

_Autonomous build cycle. Branch: `monorepo` (does **not** auto-deploy; only `main` does)._
_Reference device width: 393pt (iPhone 16). App points at production (`chess-school-alpha.vercel.app`, Turso, 16k+ lessons)._

---

## 1. Executive Summary

The Expo (React Native) mobile app now has **full feature + UI/UX parity** with the ChessSchool web PWA, plus the previously-missing flows. Every screen the web exposes exists natively, progression is computed identically to web, settings sync per-user across devices, and **networked Online PvP** works end-to-end (verified with two live clients). All backend additions were shipped to production as **additive, web-safe** changes (web `typecheck + build + e2e 9/9` green on every deploy).

**State: production-ready** for the mobile surface, pending native device QA (audio/haptics/animation feel) and a store build.

---

## 2. Completed Features

**Student flow**
- Onboarding wizard (goal · experience · time · coach · theme · avatar) — gated for new users.
- Login / register (token auth; `getApiUser` keeps web cookie auth working).
- Placement test (8 puzzles → starting ELO).
- Account / Student ID card (gradient ID, rank/house/since, library + logout).

**Learn**
- Campus map (stages → semesters → classes, sequential unlock, load-more, school-exam button).
- Class journey (milestone path, progress-ring nodes, exam node).
- Lesson player (coach bubble, board + arrows/highlights, turn indicator, hint bar, completion card with confetti + sound + stat pills + Continue/Reflect/Back).
- Library (completed lessons by semester).

**Play**
- Setup (vs Bot strength/personality/time · vs Human).
- vs Bot game (bot identity, tip bubble, material, rewind/forward scrubber, avatar).
- Pass & play (local 2-player, auto-flip).
- **Online PvP** (create/share-code/join, polling sync, per-color orientation, clocks, resign, result).

**Review / Profile / Tools**
- Review (match history + replay).
- Profile (Student ID, hub grid, stat tiles, learning profile, achievements).
- Dashboard (skill radar + activity heatmap).
- Homework (daily goal, pace incl. custom slider, schedule, routine + action).
- Journal (mistake reflections).
- Exams (class exam via lesson player; **school/stage exam** unlocks the next school).
- Settings (sound/feel, accessibility, learning/board, piece + board theme pickers).

---

## 3. Architecture Changes

- **`src/progression.ts`** — pure reducers ported 1:1 from web's Zustand stores (XP/streak/mastery/mistakes/ELO/achievements). The root-cause fix: web computes all progression client-side; mobile now does the same before `POST /api/progress`.
- **`src/progressStore.ts`** — single cached `/api/progress` snapshot via `useSyncExternalStore`; deduped across all six consumers; updated in-place after writes; cleared on auth change.
- **`src/settings.ts`** — external store, persisted (secure-store native / localStorage web) **and** synced per-user to the account (`progress.data.settings`).
- **Backend (additive, deployed to prod)** — `/api/catalog`, enriched `/api/campus` (+ `schoolExamsPassed` unlock), `/api/class/[id]`, `/api/next-lesson`, `/api/lesson/[id]`, merge-safe `/api/progress` (+ `settings` field), `/api/library`, `/api/placement`. `/api/school-exam` + `/api/session*` were already live and reused.

---

## 4. Performance Improvements (measured)

- **`/api/progress` fetches: 6 → 1** per session. TopBar (was refetching on every tab focus via `useFocusEffect`) + Learn + Profile + Review + Dashboard + Homework now share one cached snapshot.
- TopBar progress bar animates from the cache (no flash, no refetch).
- Board move animation standardized to a 220ms ease-out tween (matches web).

---

## 5. Tests Added

- **Unit (vitest): 20 passing** — `src/progression.test.ts` covers awardXp, streak transitions, mastery EWMA, Elo (K=32), mistake/weakness logs, `applyLessonComplete`, `applyMatchEnd`, levels + rank ladder. Run: `pnpm --filter mobile test`.
- **Verification harness** — Playwright drives the Expo **web export** at 393px and composites it against the logged-in web app. Used to verify every screen this cycle.
- **Online PvP** — verified with **two browser contexts** (white creates / black joins): a move syncs end-to-end with correct per-color orientation, turn indicator, and clock.
- **Web regression** — `typecheck + build + e2e (9/9)` green on every backend deploy.

---

## 6. Visual Improvements

Lesson completion (button order, stat pills, sound, turn indicator, larger board/tip); sub-screen chrome (Back button + TopBar instead of ✕); play avatar + larger bot bubble; journey TopBar + transparent show-more; campus exam + load-more; homework action + custom slider; global font bump (~+1–2px). All matched against web via the harness.

---

## 7. Asset / Motion / Audio Audit

| Category | Inventory | Parity |
|---|---|---|
| **Coach** | `Cody.tsx` (expressions: wave/think/cheer/sad/…) | original SVG, shared with web feel |
| **Icons** | `Icon.tsx` (in-house SVG set) | original, no icon fonts |
| **Piece themes** | classic · marble · crystal · neon · forest · ocean · blossom (7) | `Piece.tsx`, persisted + synced |
| **Board themes** | classic · green · wood (3) | `settings.ts`, persisted + synced (verified end-to-end) |
| **Audio (SFX)** | move · capture · success · error · win | `sfx.ts` (expo-audio), volume + mute via settings |
| **Haptics** | tap · success · error | `haptics.ts` (expo-haptics) |
| **Motion** | board slide (220ms), Confetti burst, TopBar fill, progress rings | `Animated` + react-native-svg |

No duplicate or broken assets found. Native audio/haptics need on-device confirmation (can't be exercised in the web-export harness).

---

## 8. Curriculum Progress

Unchanged and preserved — app reads the production DB (Turso): **16,128 lessons / 61 classes / 9 semesters**. No curriculum was authored or removed here.

---

## 9. Backend & Deployment Readiness

- All API additions are **additive and web-safe**; each was verified (`typecheck + build + e2e`) in a worktree off `origin/main` before fast-forwarding to `main`.
- Production deploys from `main` (old root structure) via Vercel Git integration.
- The monorepo restructure remains on the `monorepo` branch (pushing it to `main` needs a one-time Vercel **Root Directory → apps/web** dashboard change).
- Mobile ships via EAS/Expo (not yet built for stores).

---

## 10. Known Risks

1. **Native-only feel** (audio latency, haptics, animation smoothness) is unverified — the harness proxies layout via react-native-web, not native runtime.
2. **Web↔app settings sync is one-way for now**: the app reads/writes account settings; the **web** store still uses localStorage, so full bi-directional sync needs a small additive web change.
3. **Journey connector lines vs zigzag nodes** misalign — a known bug in **web too**; intentionally left for a shared fix (per request).
4. **Online PvP** has no matchmaking queue (share-code only) and no reconnect/timeout UI beyond the server clock.
5. **`EXPO_PUBLIC_API_URL` is bundle-time** — switching environments requires `expo start -c` / re-export.

---

## 11. Release Notes (this cycle)

- ✨ Online PvP (create/join by code, live sync, clocks, resign).
- ✨ Pass & play, Placement test, Account/Student ID, Library, School exam.
- ⚡ Single cached progress fetch across all screens; animated TopBar.
- 🔁 Per-user settings sync (themes follow the account).
- 🎯 School exam unlocks the next school (campus honors `schoolExamsPassed`).
- 💅 Lesson/play/journey/campus/homework polish; +font scale.
- ✅ 20 unit tests; web e2e stays 9/9.

---

## 12. Commit Timeline (recent → older)

`test: progression unit tests` → `Online PvP` → `School exam` → `Pass & play` → `Account/Library/Placement` → `cache optimisation` → `journey/font polish` → `campus/homework polish` → `play polish` → `settings sync` → `cached progress store` → `lesson/board polish` → `onboarding` → `progression logic` → `dashboard` → … (full parity build).

---

## 13. Before vs After

| | Before this cycle | After |
|---|---|---|
| Remaining screens | Online PvP, account, placement, library, exams missing | all built + verified |
| Progress fetches | 6 per session | 1 (cached) |
| Settings | local only | synced per-user to account |
| vs Human | options shown, non-functional | pass & play + online PvP both work |
| Tests | none (mobile) | 20 unit + 2-client PvP verification |
| School exam | none | unlocks next school |

---

## 14. Recommendations (next)

1. **Native QA pass** on a device/simulator (audio, haptics, animation, safe-areas, keyboard).
2. **Bi-directional settings sync** — small additive web change so web reads/writes `progress.data.settings`.
3. **EAS build** + store assets (icon/splash already via Expo).
4. Online PvP polish: matchmaking queue, reconnect, opponent-left handling, optional Ably push (`ABLY_API_KEY`).
5. Promote the monorepo to `main` (Vercel Root Directory change) to unify the repo.
6. Add a couple of Playwright **route-smoke** specs for the mobile web export to guard against route regressions.

---

## 15. Handoff — how to run & verify

```bash
# Dev (points at prod by default via .env EXPO_PUBLIC_API_URL)
pnpm --filter mobile start          # then press w (web) / i (iOS) / a (Android)

# Tests
pnpm --filter mobile test           # 20 unit tests
pnpm --filter mobile typecheck      # tsc --noEmit

# Parity harness (web export vs logged-in web, 393px)
cd apps/mobile && npx expo export --platform web --output-dir dist
python3 -m http.server 8088 --directory dist      # or the SPA-fallback server for deep routes
node apps/web/scripts/parity-shot.mjs <screen>    # composites WEB | APP

# Backend deploy (additive only) — verify before pushing
git worktree add -b deploy/x ~/duochess-hotfix origin/main
# copy changed apps/web files onto the root structure, cp local.db, then:
pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm e2e   # must stay 9/9
git push origin deploy/x:main
```

**Parity test account (prod):** `parity-bot@duochess.dev` / `parity12345`.
**Online PvP 2-client check:** open two browser contexts, create on one, join the code on the other, move syncs.

_Preserved per requirements: save data, curriculum, PWA (web), themes, onboarding, journey UI, offline behavior, history. No working features removed._
