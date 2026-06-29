# Web → App parity audit

Source of truth: the web app (`apps/web`). Status of each surface in the native app (`apps/mobile`).
Legend: ✅ done · 🟡 partial · ❌ missing · ⛔ N/A (web-only / not applicable to native)

> **Verification method:** Expo **web** export (react-native-web) driven by Playwright at phone size,
> screenshotted and compared to a web screenshot of the same screen, **pointed at production** so
> content (16k lessons) is real. Blind spots that need **on-device** checks: **audio**, **animation/motion**,
> native feel. Those are marked 🎧/🎬 below.

---
# 📊 CURRENT-STATE AUDIT (Phase B in progress — updated)

## Routes / screens (web → app)
| Web route | App screen | Status | Gap |
|---|---|---|---|
| `/login` `/register` | `login.tsx` | ✅ | combined; no onboarding after enroll |
| `/onboarding` `/welcome` | — | ❌ | new-user wizard (house/avatar/coach/pace) |
| `/placement` | — | ❌ | card shows on Learn, but no 8-puzzle test |
| `/` (home + campus) | `(tabs)/index` | ✅ | matched: campus accordion, TopBar, resume, placement card, daily goal |
| `/lesson/[id]` | `lesson/[id]` | ✅ | residual: exact react-chessboard piece art |
| **`/class/[id]` (Journey)** | `class/[id]` | 🟡 | **app = flat lesson list; web = milestone journey path (nodes/stations)** |
| `/class/[id]/exam` | — | ❌ | class graduation exam |
| `/exam/school/[stage]` | — | ❌ | school/stage exam |
| `/library` `/library/lesson/[id]` | `classes.tsx` | 🟡 | browse only; no search / free-lesson view |
| `/play` (setup) | `(tabs)/play` | ✅ | New-match setup matched |
| `/play` (in-game) | `play/game.tsx` | 🟡 | no clock/material/move-list/resign; JS bot not Stockfish |
| `/play/online/[id]` | — | ❌ | online PvP (Ably) |
| `/playground` | — | ❌ | free analysis board |
| `/review` `/review/[id]` | `(tabs)/review` `replay/[index]` | 🟡 | list + replay ok; no move-list/eval in replay |
| `/practice/mistakes` | — | ❌ | drill logged mistakes |
| `/journal` | `journal.tsx` | 🟡 | shows mistakes; none get logged from app (P1) |
| `/dashboard` | — | ❌ | skill radar + activity heatmap (Profile has basic stats) |
| `/profile` | `(tabs)/profile` | ✅ | matched: hub grid, stats, learning profile |
| `/plan` `/homework/[id]` | `homework.tsx` | 🟡 | opens lessons; no routine/streak gating |
| `/settings` `/themes` | `settings.tsx` | ✅ | sound/haptics/reduce-motion + board + piece themes |
| `/account` | — | ❌ | email/password/delete |
| `/admin` | — | ⛔ | web CMS |
| `/offline` | — | ⛔ | native handles offline differently |
| — | `stage/[id]` | ⚠️ | app-only; now orphaned (campus links straight to class) |

## Components (web → app)
| Web component | App | Status |
|---|---|---|
| TopBar · BottomNav · Mascot · Button · Icon · CampusMap · ResumeCard · ChessBoard · pieceThemes · MatchChooser | TopBar · (tabs) · Cody · Button · Icon(28) · CampusMap · (inline) · ChessBoard · Piece · play setup | ✅ |
| AppShell (shared chrome) | per-screen SafeAreaView | 🟡 no shared shell |
| Card · ProgressBar · NavButton | inline styles | 🟡 not extracted as primitives |
| Toggle | RN Switch | ✅ |
| LessonPlayer · MatchView | lesson · play/game | 🟡 MatchView missing clock/material/movelist/resign |
| AnimatedNumber | static text | ❌ |
| Confetti | — | ❌ (no lesson-complete celebration) |
| ConfirmDialog · Sheet · Toaster · Select · NavProgress · Logo | — | ❌ |
| SkillRadar · StreakHeatmap (dashboard) | — | ❌ |
| OnboardingWizard | — | ❌ |

## Feature areas (web `features/*` → app)
board ✅ · chess-engine ✅(core) · lessons ✅ · school ✅campus/🟡journey · play ✅setup/🟡game · review 🟡 · settings ✅ · journal 🟡 · coaching 🟡(text only) · **progression ❌ (the root-cause logic gap — see below)** · placement ❌ · dashboard ❌

## Headline
**Visually matched:** Learn, Lesson, Play-setup, Profile, TopBar.
**Biggest open items:** ① **class Journey** (flat list → milestone path) · ② **progression logic** (`packages/progression` — drives mistakes/streak/XP/ELO/achievements) · ③ missing screens (onboarding, placement, exams, dashboard, account, practice, online PvP) · ④ missing UI primitives (Confetti, Sheet, Toaster, Select, AnimatedNumber, dashboard viz).

---
## Content / data
| Item | Status | Notes |
|---|---|---|
| 16k curriculum (lessons/classes/semesters) | 🟡 | App APIs return whatever DB they hit. Fix = point `EXPO_PUBLIC_API_URL` at **production** (Turso has 16k). Local base seed = 53 only. |
| Progress sync (xp/rating/lessons/achievements/games) | ✅ | Token auth + `/api/progress`. |

## Screens (web route → app)
| Web | App status | Gap to close |
|---|---|---|
| `/login` `/register` | ✅ | Combined `login.tsx`. |
| `/onboarding` `/welcome` | ❌ | Wizard after enroll (house/avatar/coach/pace). |
| `/placement` | ❌ | 8-puzzle placement → starting level. |
| `/` (home + **campus map**) | 🟡 | Campus stages + resume + homework done. Missing: placement entry, exact campus parity (semester accordions, per-class Start). |
| `/lesson/[id]` | 🟡 | Layout + arrows + highlights + 3D pieces + sounds done. Verify: every step kind, exact react-chessboard pieces, coach personality lines. |
| `/class/[id]` (journey) | 🟡 | Lesson **list** done; web has a journey **map** + per-lesson lock/stars. |
| `/class/[id]/exam` | ❌ | Class exam (pass to graduate). |
| `/exam/school/[stage]` | ❌ | School/stage exam. |
| `/library` `/library/lesson/[id]` | 🟡 | "Browse all classes" ≈ library; no free lesson browse/search. |
| `/play` (setup → game) | 🟡 | Board + bot done. Missing: **New match setup** (mode cards, strength, time control), **clock**, **pass-and-play**, adaptive auto-level. |
| `/play/online/[id]` | ❌ | Online PvP (matchmaking + realtime, Ably). |
| `/playground` | ❌ | Free analysis board. |
| `/review` `/review/[id]` | ✅ | Review tab + replay with controls. |
| `/practice/mistakes` | ❌ | Drill your logged mistakes (journal shows them only). |
| `/journal` | ✅ | Mistakes review with mini-boards. |
| `/dashboard` | ❌ | Skill radar + activity heatmap. (Profile = report card only.) |
| `/profile` | ✅ | Hub (ID + stats + menu + achievements). |
| `/plan` `/homework/[id]` | 🟡 | Homework screen + lessons done. Missing: full routine/streak gating, plan view. |
| `/settings` | ✅ | Sound/haptics/reduce-motion. |
| `/themes` | ✅ | Board themes + **piece themes** (7, ported from web). |
| `/account` | ❌ | Account management (email/password/delete). |
| `/admin` | ⛔ | Web-only CMS. |
| `/offline` | ⛔ | Native app handles offline differently. |

## Cross-cutting behaviors
| Behavior | Status | Notes |
|---|---|---|
| Cody mascot **motion** | ❌ 🎬 | Mobile Cody is a **static PNG**. Web animates (wave/bounce/idle) via Framer Motion → add Reanimated. |
| Sound effects | 🟡 🎧 | Synthesized WAVs + expo-audio wired (move/capture/success/error/win). Needs device confirm + tuning. |
| Board move animation | 🟡 🎬 | Slide wired (lessons + play). Needs device confirm. |
| Piece themes | ✅ | 7 themes (marble/crystal/neon/forest/ocean/blossom/classic). |
| Board themes | ✅ | Classic/Green/Wood matched to web. |
| Haptics | ✅ | Gated by setting. |
| Achievements | ✅ | Shared `@chess-school/core`. |
| Adaptive bot / ELO | 🟡 | ELO pills; no auto-adapt to player level. |
| Coach personality | ❌ | Web has selectable coach voice; lessons use it. |
| Clock / time control | ❌ | No clock in play. |
| Pass-and-play | ❌ | Two-players-one-device. |

---

# Behavioral parity — built features (cited diff, web file:line)

## ⭐ ROOT CAUSE (the one that explains most gaps)
The web computes **all progression as client-side side-effects** in Zustand stores
(`core/store/progression.store.ts`, `plan.store.ts`), called from `LessonPlayer.tsx` / `MatchView.tsx`.
The `/api/progress` route is a **dumb store** — it computes nothing.
**Mobile has no progression store**; each screen does `GET /api/progress` → mutate 1–2 fields → `POST`.
So every effect the web computes is simply **lost on mobile**. → **Fix once by extracting the progression
logic into a shared package both surfaces use** (`packages/progression`, pure reducers + injectable storage).
This single fix closes ~10 behavioral gaps at once with *identical* behavior.

## Lesson player (`web/features/lessons/LessonPlayer.tsx` vs `mobile/app/lesson/[id].tsx`)
Same: step kinds info/observe/move, arrows+highlights while playing, flat `lesson.xp`, unlimited attempts, progress-bar math, `step.coach` only (no personality on either).
Missing on mobile:
- ❌ Wrong move **not logged** (`logMistake`, LessonPlayer:278) → Journal never fills from app.
- ❌ Wrong move **snaps back**; web plays it, flags dest **red** (`checkSquare`) 1300ms then reverts.
- ❌ **No weakness tracking** (`recordWeakness(step.tag)`, :276); mobile `Step` has no `tag`.
- ❌ Mastery = raw ratio + `attempts:1` always + `dueAt` fixed +1d; web EWMA blend + 1/2/5/14d schedule.
- ❌ **No achievements**, **no streak/activity**, **no today-XP/heatmap**, **no graduation/exam**, **no homework check-off** on complete.
- ❌ **Hint is static text**; web has progressive reveal (L1 highlight from-square → L2 draw solution arrow).
- ❌ **No opponent-reply animation** between move steps (`findReply`); mobile jumps fen.
- ❌ No promotion message, no capture-vs-move sound split in observe, no success-square green flash.
- ❌ Complete screen: no confetti, no mistakes stat, no "Continue → next lesson" chain, no Reflect/enroll prompt; mobile only "Back to academy".

## Play (`web/features/play/{MatchChooser,MatchView}.tsx` vs `mobile/app/(tabs)/play.tsx`)
Same: core engine + JS negamax bot + game-over banner + last-move highlight + move/capture sfx.
Missing on mobile:
- ❌ **No setup screen** (mode cards / strength / time); ❌ **no vs-Human pass-and-play**; ❌ no online link.
- ❌ Bot is **JS negamax only** — web wires **Stockfish-18 WASM** for ELO ≥ 800 (much stronger).
- ❌ **No adaptive bot**; only 600/1000/1400/1800 (can't reach 300 or 2000+).
- ❌ **Rating/ELO never updated** after games (`updateRating`, K=32) + no `botWins`.
- ❌ No **clock**, no **captured-material**, no **move list/scrubber**, no **resign/draw**, **auto-queens** (web has chooser).
- ❌ No check highlight. Game save = minimal `{moves,result,elo,at}` server-side vs web's full PGN SavedGame (Dexie).
- ❌ Bot win awards **+40 XP** on web; mobile awards none.

## Board (`web/features/board/ChessBoard.tsx` vs `mobile/src/ChessBoard.tsx`+`Piece.tsx`)
Same: tap-to-move logic, legal-dot/capture-ring split, last-move + selected tints, arrows, highlights, silhouette piece geometry, 3 shared board-theme colors.
Missing on mobile:
- ❌ **No drag-and-drop** (web has drag + tap); ❌ no promotion chooser; ❌ no coordinates (a-h/1-8).
- ❌ No check highlight, no success-flash square.
- 🟡 Default piece = marble silhouette; web default = react-chessboard **classic Staunton** (different look).
- 🟡 **3 board themes vs web's 8** (missing chalkboard/marble/neon/paper/midnight).
- 🐞 Piece-theme id mismatch: web blossom = `"cute"`, mobile = `"blossom"` → saved web pref won't resolve.

## Progression side-effects (`core/store/progression.store.ts`,`plan.store.ts`)
Replicated: total XP, a (degraded) lesson record, display of all fields.
NOT replicated: today-XP + `activityDays` heatmap (→ mobile daily-goal bar uses lifetime XP, **wrong**), streak/`registerActivity`, EWMA mastery + spaced-rep `dueAt`, `logMistake`, `recordWeakness`, Elo `updateRating` + `botWins`, **all** achievement unlocks (lesson + match), homework routine check-off + `homeworkStreak`, class `graduateClass` + `passSchoolExam`.

---

# Priority order (revised after audit)
1. **Deploy additive backend to prod** (web-safe; e2e green) → app gets **16k content**. _(config/deploy)_
2. **⭐ Extract shared progression package** → wire mobile lesson/play/homework through it. Fixes mistakes, streak, today-XP, mastery/spaced-rep, weakness, ELO, achievements, homework streak, graduation **in one move, identical to web**.
3. **Cody motion** (🎬) + **audio tuning** (🎧).
4. **Board**: drag-to-move, promotion chooser, coordinates, check-highlight, remaining board themes, classic piece set, blossom id fix.
5. **Play**: New-match setup + clock + material + move-list + resign + adaptive + (later) Stockfish WASM.
6. **Lesson**: progressive hints, wrong-move-shown-red, opponent-reply animation, richer complete screen.
7. **Onboarding + placement**, **exams + journey map**, **dashboard**, **practice/mistakes**, **online PvP**.

---
# 🔧 Polish backlog (noted by user — fix later, not now)
1. **Journey connector lines misalign with the node circles** — bug present in BOTH web and app (the vertical connectors don't line up with the zigzag-offset circles).
2. **TopBar progress refetches `/api/progress` on every screen** — same data + component, should dedupe/cache (don't refetch per tab). Also add an **initial-load animation** to the progress bar fill.
3. **Journey "Show more lessons" button** → should have a **transparent/ghost** background.
4. **Journey view lacks the TopBar + bottom nav** in the app (it's a bare stack screen; web keeps the chrome).
5. **Font sizes across the app** can be **increased slightly** (global bump).
6. **Data fetching/caching optimisation** — lots of redundant `/api/progress` (and other) fetches across screens; introduce a shared cached store / SWR-style caching + dedupe. Significant optimisation scope.

## More noted points (batch 2 — fix later)
7. **"Test to unlock next school"** button missing in Learn campus (web shows a school-exam button above the next, locked school).
8. **"Load more classes"** button per school (pagination within a school) — wanted in BOTH app and web.
9. **Turn indicator** (whose move — black/white) missing on the lesson screen in app.
10. **Bottom tip** can be larger; lots of empty space below the board (both app and web).
11. **Lesson-completion has no sound** in app (web plays a completion/celebration sound).
12. **Campus reloads** when returning from a class — cache data + smoother UX (ties to backlog #6 caching).
13. **Play-vs-Bot (in-game) screen** doesn't match web — missing **bot name/avatar, tips, rewind/forward** controls, material.
