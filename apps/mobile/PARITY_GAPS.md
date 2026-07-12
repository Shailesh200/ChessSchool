# Web → Mobile Parity Gaps

> **Status (Jul 2026):** Most P0/P1 gaps are **landed** — guest-gating, class exams, themes, report card, ReflectSheet, game saves, Google Sign-In UI, profile/onboarding API sync, and real Student ID on account. Remaining backlog is mostly P2 polish (overlay diff, modals, sound parity) and admin-only Playground.

**Source of truth:** `apps/web` (the production Next.js PWA). **Target:** `apps/mobile` (Expo React Native).
**Method:** direct code audit of current source (not runtime).
**Goal:** a single backlog of every place the app diverges from web — features, logic, UI/CSS/alignment, animation, sound, colors/themes, guest-gating, and button/modal handlers.

> **Note:** Sections below retain historical audit detail. For current shipped state, see `apps/mobile/PLAN.md` §D and verify in code before picking up an item.

> This document is organized two ways on purpose (per request):
> **Part A — by area** (cross-cutting systems) and **Part B — screen by screen**.
> Every item is tagged with a **priority** and a **web citation** so it can be picked up directly.

---

## 0.1 Priority rubric

| Tag | Meaning |
| --- | --- |
| **P0** | Feature entirely missing OR broken behavior / data loss / security / guest can reach gated content / cross-surface data corruption. Do first. |
| **P1** | Notable feature or logic gap users will clearly feel. |
| **P2** | UI / CSS / alignment / animation / sound mismatch. |
| **P3** | Minor polish, copy, color nuance, timing. |

Category labels used inline: `[Feature]` `[Logic]` `[UI/CSS]` `[Animation]` `[Sound]` `[Color/Theme]` `[Guest]` `[Modal/Handler]` `[Security]`.

## 0.2 Executive summary (updated Jul 2026)

Mobile now has **broad parity** with web for core school flows: curriculum, lessons, play (bot/pass/online), exams, placement, journal reflections, dashboard analytics, guest-gating, app themes, and account sync. **Recently closed gaps:**

- Google Sign-In button + `loginWithGoogle` (`apps/mobile/app/login.tsx`, `src/GoogleSignInButton.tsx`)
- Profile REST API + onboarding persistence (`/api/profile`, `/api/profile/onboarding`)
- Real Student ID / house / enrolled date on account (`apps/mobile/app/account.tsx`)
- Guest progress merge toast after login (`apps/mobile/src/auth.tsx`)
- Homework routine auto-tracking + streak (`apps/mobile/src/homeworkRoutine.ts`)
- Placement aligned with web (`graduateClass`, 70%/40% cutoffs, opt-out)
- Exam pass bar 67% + tutorial silent completion (`apps/mobile/src/classExam.ts`)
- Online seat token persistence (`apps/mobile/src/onlineSeat.ts`)
- Review metadata + replay by game id; academy homework done banner

**Remaining gaps** (lower priority — polish / optional):

1. **Visual polish** — overlay diff per screen, designed modals/toasts, route transitions (P2).
2. **Admin Playground** — web-only admin tool; no mobile route needed for students (P3).
3. **Coach TTS + move commentary** — web server-side read-aloud; mobile uses static bot copy (P1 feel).
4. **Bot match resume** — web persists in-progress games; mobile resets on leave (P1).
5. **Class-level journey unlock** — web gates by graduation chain; mobile journey is in-class only (P1).
6. **Sound/animation depth** — differentiated SFX voices, Cody motion (P2).

## 0.2a Original executive summary (historical audit — Jul 2026)

1. **Guest-gating is inverted** — web hides progress chrome / personal data / account from guests; mobile shows everything to guests (P0/P1).
2. **App-wide color themes + dark mode don't exist on mobile** — the single biggest visual-system gap; onboarding "theme" choice is mis-mapped to a board theme (P0/P1).
3. **Graduation/exam logic is incomplete** — `graduateClass` is never called on mobile; no `/class/[id]/exam` route; school-exam pass bar differs (75% vs 67%) (P0/P1).
4. **Data lives in two different stores** — web saves games + journal to local Dexie; mobile saves a thin `recentGames` to `/api/progress`; pass & online games aren't saved at all; reflections aren't captured anywhere (P0).
5. **Online PvP security** — sessions trust client-supplied color and use guessable IDs (P0, affects web too).
6. **Missing depth features** — checkmate analysis in replay, Practice/Mistakes drill, Report Card/GPA, Mistake DNA, graduation forecast, Playground, ReflectSheet, progressive hints, promotion chooser, clocks (P0/P1).
7. **Polish layer** — designed modals (ConfirmDialog), Toaster, Sheet, AnimatedNumber, NavProgress, route transitions, Cody motion, ~12 missing sound voices, theme-aware board overlays (P2).

## 0.3 `PARITY.md` is stale — corrections

The existing `apps/mobile/PARITY.md` predates a lot of work. **These claims in it are now FALSE** (verify against current code):
- ❌ "no confetti / no mistakes pill" — both exist (`apps/mobile/app/lesson/[id].tsx:174,182`, `apps/mobile/src/Confetti.tsx`).
- ❌ "wrong move not logged / no EWMA / no achievements / no streak" — all ported (`apps/mobile/src/progression.ts:36-88`).
- ❌ "no drag-and-drop / no turn indicator" — present (`apps/mobile/src/ChessBoard.tsx` PanResponder; `apps/mobile/app/lesson/[id].tsx:248`).
- ❌ "placement / school-exam / online PvP / account / library / pass&play missing" — all now exist as routes.
- ❌ "dashboard ❌" — `apps/mobile/app/dashboard.tsx` exists (SkillRadar + heatmap).
- The "daily goal uses lifetime XP" bug is **fixed** (`apps/mobile/app/(tabs)/index.tsx:57` uses `activityDays[today]`).

Treat **this file (`PARITY_GAPS.md`) as current**; `PARITY.md` was retired in M-071 (redirect stub only).

---

# PART A — Gaps by area (cross-cutting)

## A1. Guest-mode gating  *(directional bug: web restricts UI for guests, mobile does not)*

Web treats `authed === false` as a real state and hides/alters chrome. Mobile carries a `guest` flag in `apps/mobile/src/auth.tsx` but **never reads it for UI gating**.

- **P0 `[Guest]`** `/account` reachable by guests on mobile with a **fabricated** Student ID. Web server-redirects guests to `/login` (`apps/web/app/account/page.tsx:20-21`); mobile renders it and fakes the student number from the user id slice (`apps/mobile/app/account.tsx:15-22`).
- **P0 `[Guest]`** Lesson-complete **enroll prompt** missing. Web shows a "Save your progress" card to guests (`apps/web/features/lessons/LessonPlayer.tsx:590-604`); mobile completion has no enroll CTA (`apps/mobile/app/lesson/[id].tsx:171-210`).
- **P0 `[Guest]`** TopBar shows full streak/level/graduated chrome to guests. Web shows an **Enroll** CTA when not authed (`apps/web/components/layout/TopBar.tsx:19-28`); mobile always shows progress (`apps/mobile/src/TopBar.tsx:20-52`).
- **P1 `[Guest]`** Profile hub: web filters `authOnly` links (Library, My ID, Report Card, Homework, Journal) for guests (`apps/web/app/profile/page.tsx:66-68`) and hides stats/achievements + shows an enroll banner (`:94-101,117`). Mobile shows all 7 hub links + full stats/achievements/logout to guests (`apps/mobile/app/(tabs)/profile.tsx:24-118`).
- **P1 `[Guest]`** Learn tab: web swaps to guest copy ("Enroll to the academy…") and hides the rating chip + homework banner (`apps/web/components/home/HomeClient.tsx:40-99`); mobile always shows the logged-in variant (`apps/mobile/app/(tabs)/index.tsx:74-130`).
- **P1 `[Guest]`** Settings: web shows a "Guest mode" footer and hides the data section unless authed (`apps/web/app/settings/page.tsx:121-125`); mobile has no guest label.
- **P2 `[Guest]`** Cold-start is inverted: web opens the campus to everyone (`apps/web/app/page.tsx`), mobile forces the login gate first (`apps/mobile/app/_layout.tsx:25`). Decide which model is canonical for the app.

## A2. Theme system & colors

- **P0 `[Color/Theme]`** **No app-wide color theme system / dark mode on mobile.** Web has 6 app themes recoloring every surface — `default/blue/forest/ivory/royal/midnight(dark)` (`apps/web/core/themes/themes.ts:47-54`, CSS `apps/web/app/globals.css:255-295`) + dynamic `theme-color` (`apps/web/components/providers/ClientProviders.tsx:67-74`). Mobile has a **single fixed palette** (`apps/mobile/src/theme.ts`); `app.json` only sets `userInterfaceStyle:"automatic"` with no dark tokens.
- **P0 `[Logic]`** **Piece-theme id mismatch breaks cross-surface sync:** web id is `cute`, mobile id is `blossom` (`apps/web/features/board/pieceThemes.tsx:49` vs `apps/mobile/src/Piece.tsx:21`). After sync, web falls back to Classic and mobile falls back to Marble for that theme.
- **P1 `[Logic]`** Onboarding "theme" step is mis-mapped on mobile: it sets a **board** theme via `THEME_MAP` (`blue→midnight`, `forest→tournament`, `midnight→neon`) instead of an app surface theme (`apps/mobile/app/onboarding.tsx:44-45,77`). Web sets `appTheme` (`apps/web/components/onboarding/OnboardingWizard.tsx:81`).
- **P1 `[Color/Theme]`** School brand themes (4: Elementary/High-School/University/Graduation) exist on web only (`apps/web/core/themes/themes.ts:66-71`); absent on mobile.
- **P2 `[Color/Theme]`** Board themes: the **8 main themes match hex 1:1** (classic/chalkboard/marble/tournament/wooden/neon/paper/midnight). But legacy alias **ids differ** — web `violet/slate/forest`, mobile `green/wood` (`apps/mobile/src/settings.ts:137-153`) — old backups won't resolve.
- **P2 `[UI/CSS]`** Mobile board overlays (last-move `#ffe08a`, selected `#7be0b3`) are **hardcoded**, not derived from the theme's `move` color (`apps/mobile/src/ChessBoard.tsx:264-266`). (Web hardcodes too, so this is a shared cleanup, but it blocks true per-theme board accents.)
- **P2 `[Feature]`** Theme Studio: web has mini-board swatches + full-screen preview modal (`apps/web/app/themes/page.tsx:65-100`); mobile has an inline preview only, no modal (`apps/mobile/app/themes.tsx:28-30`).
- **P1 `[Color/Theme]`** Status bar / theme-color does not track theme on mobile (no app themes to track).

## A3. Progression & graduation logic *(reducers ported, but graduation is incomplete)*

Ported & matching: `awardXp`, `recordLesson` (EWMA `prev*0.5+score*0.5`), spaced-rep `dueAt` tiers, `registerActivity`/streak, `updateRating` (K=32), `botWins`, `logMistake`, `recordWeakness`, achievements (`apps/mobile/src/progression.ts:32-88` ↔ `apps/web/core/store/progression.store.ts`).

- **P0 `[Logic]`** **`graduateClass` is never called on mobile.** Web graduates on exam pass ≥67% and on all-lessons-mastered ≥0.9 (`apps/web/features/lessons/LessonPlayer.tsx:209-227`). Mobile `finish()` only calls `applyLessonComplete` (`apps/mobile/app/lesson/[id].tsx:118-127`); `graduatedClasses` is never updated → graduation badge, campus "graduated" collapse, and journey unlock chains never advance from lessons.
- **P1 `[Logic]`** School-exam pass threshold differs: web **67%** (`LessonPlayer.tsx:192-200`) vs mobile **75%** (`apps/mobile/app/exam/school/[stage].tsx:27,122`).
- **P1 `[Logic]`** Homework routine check-off: web marks `lesson`/`practice`/`match` activities + bumps `homeworkStreak` when all `ROUTINE_STEPS` done (`apps/web/core/store/plan.store.ts:88-98`); mobile only writes `homeworkDone[day]` when a lesson is opened with `?hw=` (`apps/mobile/app/lesson/[id].tsx:120-125`).
- **P1 `[Logic]`** Mastery score can't drop below ~1.0 on first clear on **either** surface (you must play every move correctly to finish, so `correct===total`) — CODE_REVIEW A-M3. Feeding first-attempt success into the score is a shared fix.

## A4. Animation & motion

- **P1 `[Animation]`** `reducedMotion` is broadly honored on web (global CSS, AnimatedNumber, Confetti) but on mobile only gates the board piece slide (`apps/mobile/src/ChessBoard.tsx:211`); mobile `Confetti` ignores it (`apps/mobile/src/Confetti.tsx:8`).
- **P2 `[Animation]`** No route/page transitions on mobile (web `apps/web/app/template.tsx:22-26` cross-fade).
- **P2 `[Animation]`** Cody mascot is a static network PNG on mobile (`apps/mobile/src/Cody.tsx:10-17`); web animates bob/wave/cheer (`apps/web/components/ui/Mascot.tsx:36-40`).
- **P2 `[Animation]`** No `AnimatedNumber` count-up on mobile (TopBar streak/level, dashboard, profile stats are static).
- **P2 `[Animation]`** No nav loading bar (`NavProgress`), no bottom-nav `layoutId` pill spring, no list stagger entrances (web `apps/web/core/motion/variants.ts`).
- **P2 `[Animation]`** Journey node active-pulse + spring entrance + whileTap on web (`apps/web/features/school/JourneyView.tsx:191-206`); mobile nodes are static (`apps/mobile/app/class/[id].tsx:32`).

## A5. Sound / audio

Web has **18 procedural voices** (`apps/web/core/audio/audioEngine.ts:15-33`): select, move, capture, promotion, check, success, fail, reward, streak, levelup, unlock, exam, graduation, victory, ambience, transition, notify, install. Mobile has **6 WAVs** (`apps/mobile/src/sfx.ts:6-13`): move, capture, select, success, error, win (and `select` is never called).

- **P1 `[Sound]`** ~12 event classes have **no mobile sound**: promotion, check, reward, streak, levelup, unlock, exam, graduation (mobile overloads `win`), transition, notify. Add to lesson/exam/campus/match/nav/toast flows.
- **P2 `[Sound]`** In-lesson sound mute toggle (web `LessonPlayer.tsx:355-366`) missing on mobile.
- **P2 `[Sound]`** Replay scrub plays move sound on web (`apps/web/features/review/GameReplay.tsx:45`); mobile replay is silent.
- **P3 `[Sound]`** `select`/volume-release/transition feedback sounds unused on mobile.

## A6. Haptics

- **P2 `[Haptics]`** Web fires haptics broadly (Button, Toggle, BottomNav, theme picks); mobile mostly limits haptics to lesson/game flows. `heavy` pattern defined but unused (`apps/mobile/src/haptics.ts`).
- **P3 `[Haptics]`** Theme picks use `tap` on mobile vs `select` on web.

## A7. Missing UI primitives

| Primitive | Web | Mobile | Priority |
| --- | --- | --- | --- |
| Toaster / `toast()` | `apps/web/components/ui/Toaster.tsx` + `core/store/toast.store.ts` | **absent** | **P1** |
| Sheet (bottom sheet) | `apps/web/components/ui/Sheet.tsx` | **absent** | **P1** |
| ConfirmDialog (designed) | `apps/web/components/ui/ConfirmDialog.tsx` | **absent** (no Alert either) | **P1** (resign/draw/import) |
| AnimatedNumber | `apps/web/components/ui/AnimatedNumber.tsx` | static Text | P2 |
| NavProgress | `apps/web/components/ui/NavProgress.tsx` | **absent** | P2 |
| Select (custom dropdown) | `apps/web/components/ui/Select.tsx` | Pressable grids | P2 |
| Card / ProgressBar / NavButton as shared primitives | yes | inline styles | P3 |
| Logo component | `apps/web/components/ui/Logo.tsx` | text emoji | P3 |

Icon set (28) and Button are at parity; mobile Button lacks a loading spinner and `danger` variant.

## A8. Settings, sync & backup

- **P0 `[Logic]`** Settings sync is **one-way**: mobile pushes full `settings` into `/api/progress` and pulls on login (`apps/mobile/src/settings.ts:89-125`), but **web never reads or writes `progress.data.settings`** (`apps/web/components/providers/ProgressSync.tsx:16-19`). So theme/coach/etc. changed on web stay local; a mobile sync can't update web, and the `cute`/`blossom` id bug (A2) corrupts what does sync.
- **P1 `[Feature]`** No JSON **export/import backup** on mobile (web `apps/web/core/backup/backup.ts`, schema v3) and no "Your data / Offline ready / storage used" trust strip (`apps/web/features/settings/DataSection.tsx`).
- **P1 `[Feature]`** Settings present on web but **non-functional/absent on mobile**: `coachPersonality` (web drives bot commentary via `apps/web/features/coaching/coach.ts`; mobile has 4 options, no `minimal`, and no coach module), `diagnostics` HUD, `textScale`. Accessibility toggles `highContrast`/`colorblind`/`hints` are **stored but not applied** on mobile (web applies via CSS `data-` attributes, `apps/web/app/globals.css:231-253`).
- **P2 `[Logic]`** Default volume differs (web `1` vs mobile `0.8`) — first sync surprises users.
- **P2 `[UI/CSS]`** Mobile duplicates board/piece pickers in **both** `/settings` and `/themes`; web keeps them only on `/themes`.

## A9. Navigation chrome / shell

- **P1 `[Feature]`** No shared `AppShell` on mobile (web `apps/web/components/layout/AppShell.tsx` = TopBar + scroll + BottomNav + `focus` mode). Each mobile screen hand-adds `TopBar`.
- **P1 `[Feature]`** **Bottom nav disappears on sub-screens** (journey, settings, dashboard, etc.) because they're stack routes outside `(tabs)`; web keeps BottomNav via AppShell. (`apps/mobile/app/class/[id].tsx` has TopBar, no tab bar.)
- **P1 `[Feature]`** No immersive **focus mode** abstraction (web hides chrome during a match: `apps/web/app/play/page.tsx:14-18`).
- **P2 `[UI/CSS]`** Profile tab icon differs (web `profile`, mobile `cap`); BottomNav has no pending/loading state on mobile.

## A10. Data sources & persistence *(two different worlds)*

- **P0 `[Logic]`** **Saved games:** web → local **Dexie** with full `SavedGame` (PGN, FEN, names, `endReason`, mode) (`apps/web/core/db/db.ts:80-86`); mobile → thin `recentGames` `{moves,result,elo,at}` in `/api/progress` (`apps/mobile/app/play/game.tsx:40-45`). **Games never cross surfaces**, and mobile loses end-reason/PGN/mode.
- **P0 `[Logic]`** **Pass & online games are not saved at all on mobile** (no `saveGame`), so they never appear in Review.
- **P0 `[Logic]`** **Journal reflections** have no store on mobile (web Dexie `journal` table). Nothing is captured.
- **P1 `[Logic]`** Replay deep-links by **array index** on mobile (`/replay/[index]`) vs stable Dexie id on web (`/review/[id]`) — reordering/deleting breaks links.

## A11. Security (online sessions — affects web too)

- **P0 `[Security]`** Online session move auth trusts **client-supplied `color`**; no seat/user binding (`apps/web/app/api/session/[id]/route.ts:79-81`; mobile posts `color: myColor` `apps/mobile/app/play/online/[id].tsx:70`). Anyone with the id can move both sides / resign either.
- **P0 `[Security]`** Session IDs are guessable: `Math.random().toString(36).slice(2,8)` (`apps/web/app/api/session/route.ts:8-15`).
- *(These are documented as CODE_REVIEW C1/C2; listed here because they gate online-PvP parity work and need a coordinated web deploy.)*

---

# PART B — Gaps screen by screen

## B1. Login / Register  (`apps/web/app/{login,register}` ↔ `apps/mobile/app/login.tsx`)
- **P1 `[Feature]`** No post-login **welcome interstitial** + `pullProgress()` on mobile; web routes to `/welcome` and merges guest→account progress with a toast (`apps/web/lib/auth-actions.ts:28`, `apps/web/app/welcome/page.tsx:17-27`, `apps/web/core/sync/pullProgress.ts:42-52`). Mobile goes straight to tabs and `progressStore.clear()` with no merge (`apps/mobile/src/auth.tsx:64-74`).
- **P1 `[Logic]`** Logout doesn't fully reset local state on mobile (settings/progression/targetElo persist → next guest inherits them). Web resets progression+session+targetElo (`apps/web/components/account/LogoutButton.tsx:18-29`).
- **P2 `[UI/CSS]`** Mobile uses text "♟️ ChessSchool" instead of the `Logo` component; register copy omits the "earn your Student ID" line.
- **P3 `[UI/CSS]`** Continue button on auth screens isn't disabled when no field; guest affordance is a prominent button vs web's subtle link.

## B2. Onboarding  (`apps/web/components/onboarding/OnboardingWizard.tsx` ↔ `apps/mobile/app/onboarding.tsx`)
Steps & options match (goal/experience/time/coach/theme/avatar).
- **P0 `[Logic]`** **Nothing is persisted to the server.** Web `saveOnboarding` writes `goal`, `avatarUrl`, `house`, `onboarded=1` (`apps/web/lib/profile-actions.ts:17-31`); mobile only sets local settings + `finishOnboarding()` (`apps/mobile/app/onboarding.tsx:72-81`). → web-registered accounts skip the wizard inconsistently; house/avatar never reach the DB.
- **P1 `[Logic]`** No `house` assignment from goal (web `HOUSE_BY_GOAL`); account hardcodes "Scholars".
- **P1 `[Logic]`** Theme step writes a board theme, not `appTheme` (see A2). Plan tier and default ELO fallback differ (`600` vs `800`).
- **P2 `[Animation/Sound]`** No step slide transitions, no enrollment celebration screen w/ confetti + "Issuing your Student ID…", no select/graduation sounds (web `OnboardingWizard.tsx:83-103,150`).

## B3. Account  (`apps/web/app/account/page.tsx` ↔ `apps/mobile/app/account.tsx`)
- **P0 `[Guest]`** Guest-reachable + **fabricated Student ID** (see A1).
- **P1 `[Logic]`** Hardcoded `House · Scholars`, `Since · 2026`; real values come from `profiles` on web (`:39-43`).
- **P1 `[Feature]`** Missing **RatingBadge** ("Player strength"), XP/Streak/Classes stat tiles, and **Download Student ID card** (web `apps/web/components/account/StudentIdCard.tsx:28-38`).
- **P1 `[Guest]`** Library button shown to everyone; web gates account→library to admins (`:55-59`).
- *(Email/password change + delete account: absent on **both** — net-new, not a parity gap.)*

## B4. Home / Campus — Learn tab  (`apps/web/components/home/HomeClient.tsx` + `features/school/CampusMap.tsx` ↔ `apps/mobile/app/(tabs)/index.tsx` + `src/CampusMap.tsx`)
- **P0 `[Feature]`** Campus card **"🎓 Test to unlock"** on a locked class (→ `/class/{prevId}/exam`) is missing on mobile; locked cards are just dimmed (`apps/web/features/school/CampusMap.tsx:333-347` vs `apps/mobile/src/CampusMap.tsx:26-50`).
- **P1 `[Feature]`** Campus **"📝 Test out"** (examId → `/lesson/{examId}`) on unlocked classes missing on mobile (`CampusMap.tsx:317-329`).
- **P1 `[Logic]`** **Campus progress is stale on tab return** — mobile loads once on mount with no `useFocusEffect`; `done/total` is baked into the fetched `stages` (`apps/mobile/app/(tabs)/index.tsx:34,52-54`). Web reads live Zustand records (`CampusMap.tsx:22,259`). Only pull-to-refresh updates mobile.
- **P1 `[Feature]`** Resume card hides entirely when school complete on mobile; web shows "🏆 You've graduated! / Review a class" + active-match resume (`apps/web/features/school/ResumeCard.tsx:43-67`).
- **P1 `[Feature]`** Homework banner has no "done" / success variant on mobile (web toggles via `ROUTINE_STEPS`, `HomeClient.tsx:72-99`).
- **P1 `[Feature]`** "Show / Hide past classes" toggle + cleared-school collapse-to-banner missing on mobile (`CampusMap.tsx:31-37,97-114`).
- **P2 `[Animation/Sound]`** ClassCard spring entrance + open sfx/haptics on web; mobile static, silent (`CampusMap.tsx:263-280`).
- *(Matched: accordions, placement entry card, daily-goal bar using today-XP, school-exam button, load-more (batch 6 vs 8).)*

## B5. Class Journey  (`apps/web/features/school/JourneyView.tsx` + `app/class/[id]/page.tsx` ↔ `apps/mobile/app/class/[id].tsx`)
- **P0 `[Feature]`** **"Test out of this class"** (≥50% mastered → `/class/{id}/exam`) missing on mobile (`JourneyView.tsx:135-152`).
- **P1 `[Logic]`** Node lock ignores **class-level unlock** on mobile (only in-class sequential mastery), so opening a locked class via `classes.tsx` shows a lesson as active (`apps/mobile/app/class/[id].tsx:62-73` vs web `isClassUnlocked` `JourneyView.tsx:34,125`).
- **P1 `[Feature]`** Journey lacks the **bottom nav** chrome (stack route). Back uses `router.back()` (may not land on campus) vs web "← Campus".
- **P2 `[Animation]`** No active-node pulse / entrance / tap animations (see A4).
- **P2 `[UI/CSS]`** "Show more lessons" is a text Pressable vs web ghost Button.
- *(Matched: zigzag milestone path + connectors + subject header — PARITY.md "flat list" is stale.)*

## B6. Class Exam  (`apps/web/app/class/[id]/exam/page.tsx`)
- **P0 `[Feature]`** **Route does not exist on mobile.** Web builds a 5-question sampled exam → `LessonPlayer` with `exam:true`, pass ≥67% → `graduateClass` (`apps/web/app/class/[id]/exam/page.tsx:18-66`, `LessonPlayer.tsx:209-215`). All the campus/journey "Test out / Test to unlock" CTAs depend on it.
- **P0 `[Logic]`** DB `isExam` lessons opened via the journey on mobile run as a **plain lesson** — no pass ratio, no graduation.

## B7. School / Stage Exam  (`apps/web` via `LessonPlayer` ↔ `apps/mobile/app/exam/school/[stage].tsx`)
- **P1 `[Logic]`** Pass bar 75% (mobile) vs 67% (web). Unlock writes `schoolExamsPassed` (mobile) vs `passSchoolExam` store action (web) — mechanisms differ but both gate campus.
- **P2 `[Modal/Handler]`** Auto-queens promotions (`:109`); underpromotion exam puzzles mis-scored.
- **P2 `[UI/Sound]`** Loading/empty/fail states + audio differ ("Building your exam…", graduation sound).

## B8. Lesson player  (`apps/web/features/lessons/LessonPlayer.tsx` ↔ `apps/mobile/app/lesson/[id].tsx`)
- **P1 `[Logic]`** **Observe step "Continue" not gated** until autoplay finishes on mobile (user can skip mid-example) — web gates via `observeReady` (`LessonPlayer.tsx:124,476`).
- **P1 `[Animation]`** **No opponent-reply animation** between move steps; mobile jumps fen, web animates `findReply` (`LessonPlayer.tsx:37-52,248-261`).
- **P1 `[Feature]`** **No promotion chooser** in lessons — hardcoded queen (`apps/mobile/app/lesson/[id].tsx:140`); underpromotion puzzles unsolvable.
- **P1 `[Feature]`** **No progressive hints** (web L1 highlight from-square → L2 solution arrow, `LessonPlayer.tsx:324-336`); mobile shows static text only.
- **P1 `[Logic]`** **Tutorial-only lessons** (no move steps) still show a celebration on mobile; web records + chains silently (`LessonPlayer.tsx:163-172`).
- **P1 `[Feature]`** No graduation / "Exam complete" completion variants; no guest enroll prompt (see A1/A3).
- **P2 `[UI]`** No **red wrong-square** flash (`checkSquare`) and no **green success-square** flash (`successSquare`) — mobile `ChessBoard` lacks these props (`LessonPlayer.tsx:405-406`).
- **P2 `[Logic]`** Mistakes are **batched** to finish on mobile (lost if lesson abandoned); web logs each immediately (`LessonPlayer.tsx:277-284`).
- **P2 `[Feature]`** Reflect = navigates to `/journal` on mobile; web opens an in-place `ReflectSheet` capturing confidence + note (`LessonPlayer.tsx:628-649`).
- **P2 `[Sound]`** Completion plays `win` always; web differentiates levelup/graduation/fail; observe move/capture split not honored.
- **P3 `[UI/Animation]`** No coach-bubble enter animation, no exam badge pill, stat-pill sizing differs, board lacks `dvh` height cap.
- *(Matched: 3 step kinds, arrows/highlights, EWMA mastery, confetti, mistakes pill, "Continue learning" chain via `/api/next-lesson`, turn indicator, drag+tap board.)*

## B9. Library  (`apps/web/app/library` ↔ `apps/mobile/app/library.tsx` + `classes.tsx`)
- **P1 `[Feature]`** No admin **free-browse** grid on mobile; `classes.tsx` is an ungated catalog with no lock indicators and isn't linked from library.
- **P2 `[UI/CSS]`** Grouped by semester (mobile) vs class name (web); opens `/lesson/[id]` directly vs `/library/lesson/[id]`.
- *(Matched: regular users see completed-only on both; neither has search.)*

## B10. Placement  (`apps/web/features/placement/PlacementTest.tsx` ↔ `apps/mobile/app/placement.tsx`)
- **P0 `[Logic]`** **Fetch failure → silent placement at Elementary** (`setPuzzles([])` then "You're placed!" with 0/0) — error/empty conflation (`apps/mobile/app/placement.tsx:33,51-54`, CODE_REVIEW A-M10).
- **P1 `[Logic]`** Different puzzle set (generic stride vs curated prefixes), different score cutoffs (85/55/30 vs 70/40), and unlock writes `schoolExamsPassed` instead of `graduateClass`-ing skipped classes (`apps/mobile/src/chess-utils.ts:53-57` vs `PlacementTest.tsx:82-88`) → cross-surface progress semantics diverge.
- **P2 `[Feature]`** No "Start from the beginning" opt-out; promotion auto-queened.

## B11. Play — setup  (`apps/web/features/play/MatchChooser.tsx` ↔ `apps/mobile/app/(tabs)/play.tsx`)
- **P1 `[Feature]`** Time-control selection is **UI-only** on mobile (passed but ignored by game) — CODE_REVIEW A-M1.
- **P2 `[UI/CSS]`** Bot persona labels differ (web banded names Pip/Cody/Remi/… vs mobile always "Cody"); adaptive doesn't dim ELO pills; no start haptics/sfx.

## B12. Play — vs Bot  (`apps/web/features/play/MatchView.tsx` ↔ `apps/mobile/app/play/game.tsx`)
- **P1 `[Feature]`** **No chess clock** (state/UI absent) even though setup offers it.
- **P1 `[Modal/Handler]`** **Resign has no confirm** — one tap = instant loss (web `ConfirmDialog`, `MatchView.tsx:495-503`).
- **P1 `[UI/CSS]`** Game-over is inline text in the coach bubble; web shows a full-screen overlay w/ confetti + rating delta + Review/Reflect/New game (`MatchView.tsx:396-447`).
- **P1 `[Feature]`** No mid-game resume after leaving (in-memory only); web persists to `match.store` + Dexie + has a `beforeunload` guard.
- **P2 `[Logic]`** Stockfish ELO mapping below ~1320 differs (skill `(elo-300)/51` vs web `(elo-700)/100`); mobile invokes Stockfish at all ELOs vs web's ≥800 threshold; think-time differs.
- **P2 `[Feature/Sound]`** No dynamic coach commentary (`commentOnMove`), no check/promotion/draw sounds, no check-square highlight, no rating-delta UI.
- *(Matched: material bars, move scrubber, shared JS-bot fallback, `applyMatchEnd` K=32 +40XP +achievements, last-move highlight, 220ms slide, native Stockfish wiring.)*

## B13. Play — Pass & Play  (`apps/mobile/app/play/pass.tsx`)
- **P1 `[Feature]`** Pass games **not saved** to history (web saves via `MatchView`); **no resign confirm**, no clock, no flip, no scrubber, no share, no check highlight; game-over is status text only.

## B14. Play — Online PvP  (`apps/web/app/play/online/[id]` ↔ `apps/mobile/app/play/online/`)
- **P0 `[Security]`** Unauthenticated session moves + guessable IDs (see A11).
- **P1 `[Feature]`** **Polling-only** on mobile (1600ms) — no Ably realtime push (web subscribes to `game:${id}`).
- **P1 `[Logic]`** Clocks don't tick locally between polls (freeze-and-jump, A-M4); no client-side timeout claim.
- **P1 `[Logic]`** Seat (color) comes from URL param and is **lost on reload** → defaults to White; web persists creator seat in localStorage.
- **P1 `[Feature]`** Online finished games **not saved** to mobile history; no share-invite sheet; no 3-min join expiry; weaker optimistic-move reconciliation.
- **P2 `[Modal/Handler]`** Resign has no confirm; game-over is a banner vs web overlay+confetti.

## B15. Review list  (`apps/web/app/review/page.tsx` ↔ `apps/mobile/app/(tabs)/review.tsx`)
- **P0 `[Logic]`** Different stores (Dexie vs `recentGames`); games don't cross surfaces; pass/online absent (see A10).
- **P1 `[Feature]`** No **"Resigned"** badge (resign stored as loss); no end-reason subtitle (stalemate/insufficient/timeout); mode always "vs Bot"; no date in row.
- **P1 `[Feature]`** No **"Recommended class"** weakness card (web `review/page.tsx:36-74`).
- **P2 `[Feature]`** No pull-to-refresh on Review (only Learn). Neither side virtualizes the list.

## B16. Replay  (`apps/web/features/review/GameReplay.tsx` ↔ `apps/mobile/app/replay/[index].tsx`)
- **P0 `[Feature]`** **No "How the checkmate happened" analysis** on mobile: attacker arrows, covered-escape highlights, back-rank/diagonal classifier, prevention tip all absent (web `GameReplay.tsx:56-150`, `replay.ts:62-118`).
- **P1 `[Feature]`** No play/pause autoplay, no scrubber slider, no tap-to-jump move list, no SAN labels; mobile is manual ⏮◀▶⏭ stepping only.
- **P2 `[Logic/Sound]`** Reconstructs from `from:to` only (no SAN/check/mate flags); starts at ply 0 vs final; silent; infinite spinner on invalid index; bypasses `progressStore` cache.

## B17. Journal & Practice  (`apps/web/app/journal` + `app/practice/mistakes` ↔ `apps/mobile/app/journal.tsx`)
- **P0 `[Feature]`** No **ReflectSheet** / journal reflection capture or store on mobile (confidence + note → Dexie on web). The whole Learning-Journal concept (entries by day, kinds, growth summary, avg confidence, delete) is absent; mobile `journal.tsx` shows only **mistake positions**.
- **P0 `[Feature]`** **`/practice/mistakes` drill** (synthetic lesson from logged mistakes) has no mobile route (web `apps/web/app/practice/mistakes/page.tsx`).
- **P1 `[Feature]`** Mistake board has no played-vs-best **arrows** on mobile (web `MistakeReview.tsx:27-30`).
- **P2 `[Logic]`** Mobile renders up to 25 embedded boards in a `ScrollView` (no `FlatList`) — perf risk.

## B18. Dashboard & Profile  (`apps/web/app/dashboard` + `components/dashboard/*` ↔ `apps/mobile/app/dashboard.tsx` + `(tabs)/profile.tsx`)
- **P0 `[Feature]`** No **Report Card** (per-class letter grades + GPA) anywhere on mobile (web `reportCard.ts` + `ReportCard.tsx`, fetched from `/api/report-classes`).
- **P1 `[Feature]`** Dashboard missing: **Mistake DNA** severity cards, **graduation forecast**, **trophy room** (wins count, best-game link, graduations), win-rate line. (Mobile has SkillRadar text + heatmap only.)
- **P1 `[UI/CSS]`** SkillRadar shows text % (no per-area progress bars); StreakHeatmap has no legend/tooltips.
- **P2 `[Feature]`** Profile learning-profile tags have no explanations / direct practice link; achievements show title only (no descriptions); stat numbers static (no AnimatedNumber).
- *(Matched: dashboard exists, skill-tree TAG_AREA mapping + `/api/curriculum-stats`, profile stat tiles, achievement grid.)*

## B19. Settings / Themes / Playground / Diagnostics
- See **A2** (no app themes / dark mode; piece id bug), **A8** (one-way sync, no backup, non-functional accessibility + coach personality + diagnostics), **A7** (no Sheet/ConfirmDialog/Toaster).
- **P1 `[Feature]`** **Playground** (free analysis board: FEN load/copy, undo, flip, hint) has no mobile route (web `apps/web/app/playground/page.tsx`).
- **P2 `[Feature]`** Diagnostics HUD (FPS/heap/route) absent on mobile.

---

# PART C — Prioritized backlog (the plan)

### P0 — do first (blockers / data / security / guest)
1. Guest-gating pass on mobile: hide TopBar progress, profile stats/hub links, account; add lesson-complete enroll prompt; gate `/account` (A1, B1–B4, B8).
2. App-wide **theme system + dark mode** on mobile; fix onboarding theme mapping; fix `cute`/`blossom` piece id (A2, B2, B19).
3. Wire **graduation**: add `graduateClass`/exam logic + `/class/[id]/exam` route; reconcile school-exam threshold (A3, B5–B7).
4. Unify **data/persistence**: shared game store across surfaces; save pass & online games; capture journal reflections (A10, B13–B17).
5. Fix **placement** error-vs-empty silent misplacement (B10).
6. Online-PvP **security** (seat auth + CSPRNG ids) — coordinated web deploy (A11, B14).
7. Restore depth features users expect: **checkmate analysis** in replay, **Practice/Mistakes** drill, **Report Card/GPA** (B16–B18).

### P1 — notable gaps
Onboarding server persistence + welcome/merge + logout reset (B1–B2); campus test-out/test-to-unlock + stale-progress refresh + resume/homework states (B4–B5); lesson observe-gating, opponent-reply animation, promotion chooser, progressive hints, tutorial-skip (B8); bot/pass clocks + resign confirm + game-over overlay + resume (B12–B13); online realtime/clock/seat/history (B14); review badges + recommended class (B15); dashboard Mistake DNA / forecast / trophy room (B18); settings sync bi-directional + coach personality + backup; Toaster/Sheet/ConfirmDialog; AppShell + bottom-nav-on-subscreens + focus mode (A7–A9).

### P2 — UI / CSS / animation / sound
Red/green move-square flashes; ~12 missing sound voices; route transitions + Cody motion + AnimatedNumber + NavProgress; theme-aware board overlays + Theme Studio preview modal; Stockfish ELO-mapping alignment; replay controls/move list; pull-to-refresh + list virtualization; accessibility toggles applied (highContrast/colorblind/reducedMotion).

### P3 — polish
Persona labels, copy parity, button disabled states, stat-pill sizing, legacy theme alias ids, volume default, Logo component, haptic pattern coverage, font-scale pixel parity.

---

## Appendix — audit provenance
Compiled from six parallel code audits of `apps/web` vs `apps/mobile` (current branch): auth/onboarding/account/guest/nav, campus/journey/library/placement/exams, lesson player, play/engine/online, review/journal/dashboard, and cross-cutting themes/animation/sound/primitives. All citations point at live source; where this file and `apps/mobile/PARITY.md` disagree, trust this file.
