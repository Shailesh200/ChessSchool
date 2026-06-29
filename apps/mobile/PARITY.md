# Web → App parity audit

Source of truth: the web app (`apps/web`). Status of each surface in the native app (`apps/mobile`).
Legend: ✅ done · 🟡 partial · ❌ missing · ⛔ N/A (web-only / not applicable to native)

> **Verification method:** Expo **web** export (react-native-web) driven by Playwright at phone size,
> screenshotted and compared to a web screenshot of the same screen, **pointed at production** so
> content (16k lessons) is real. Blind spots that need **on-device** checks: **audio**, **animation/motion**,
> native feel. Those are marked 🎧/🎬 below.

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
