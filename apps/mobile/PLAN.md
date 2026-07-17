# Implementation plan — full web↔app parity

Companion to [`PARITY_GAPS.md`](PARITY_GAPS.md) (the audit backlog). This is the *how*. Bar: **visually indistinguishable at a glance + behaviorally identical**. (Honest caveat: native RN ≠ web CSS at the literal pixel level — font metrics, flexbox rounding, and shadows differ slightly — so "pixel-perfect" is asymptotic, not absolute.)

## A. How we resolve STYLING + POSITIONING (the visual gap)
The problem so far: I've eyeballed screenshots. The fix is a **measured, token-driven** method, per screen:

1. **Shared design tokens.** Extend `apps/mobile/src/theme.ts` to mirror web's `@theme` in `app/globals.css` *exactly*: the full **spacing scale** (4/8/12/16/20/24…), **font sizes + line-heights**, **radii**, **shadows**, **colors** (colors/radii/font already match). One source of numbers.
2. **Per-screen spec sheet.** For each screen, read the web component's Tailwind classes and translate to pixels (px-4=16, py-3=12, gap-2=8, text-lg=18/28, rounded-card=20…). Apply the *same numbers* in the RN `StyleSheet`. No guessing.
3. **Overlay diffing (automated).** Screenshot web and the Expo-web app at the **same phone width** (375/390/414), overlay them, measure positional deltas (header height, card padding, font size, element order/spacing). Iterate until within tolerance. Track per screen.
4. **Component primitives.** Build RN equivalents of web's shared UI (Card, Button, Pill, ProgressBar, Sheet, Row) once, with web's exact paddings/radii, so every screen inherits correct styling.
5. **Typography.** Match font size **and** line-height **and** weight per text role (h1/h2/body/caption) to web's; Fredoka metrics differ slightly — accept ≤1px drift.

Verification of visual parity = the overlay-diff harness (below), screen by screen, logged in `PARITY_GAPS.md`.

## B. How we resolve BEHAVIOR (the logic gap)
Root cause (see `PARITY_GAPS.md`): web and mobile now share `@chess-school/progression`; remaining gaps are mostly UI/guest-gating and depth features.
**Fix = extract `packages/progression`** — pure functions (`recordLesson`, `awardXp`, `registerActivity`,
`logMistake`, `recordWeakness`, `updateRating`, `checkLesson/MatchAchievements`, `markHomework`,
`graduateClass`, spaced-rep `dueAt`) with **injectable storage**. Web's store delegates to it (no behavior
change → web safe); mobile imports the same functions and applies them to its snapshot before `POST`.
→ Identical XP/streak/mastery/mistakes/weakness/ELO/achievements/homework/graduation on both.

## C. How we VERIFY parity (and the honest blind spots)
- **Automated (I can do):** Expo→web export + Playwright at phone size, **pointed at production** (real 16k), screenshotted and **overlay-diffed** against a web screenshot of the same route. Catches layout, data, navigation, regressions.
- **Device-only (you confirm):** audio (🎧) and animation/motion (🎬) can't be seen in static screenshots. I'll ship a per-release **device checklist** for these.
- **Logic:** unit-test `packages/progression` so web + app provably compute the same outputs.

## D. Phased execution (status 2026-07-12)
- **P0 — Content:** ✅ DB-driven curriculum + Lichess import on prod
- **P1 — Shared progression:** ✅ `packages/progression` wired on mobile
- **P2 — Visual parity:** 🟡 ongoing — overlay diff per screen
- **P3 — Board/Play:** 🟡 clocks, promotion, themes largely done; polish remains
- **P4 — Lesson depth:** 🟡 hints, animations, enroll prompt (M-057 web)
- **P5 — Feel:** 🟡 Cody motion, audio parity
- **P6 — Missing screens:** ✅ core routes + profile/onboarding API sync; library depth varies
- **P7 — Online PvP:** ✅ foundation + seat auth; Ably when `ABLY_API_KEY` set on server
- **P8 — Auth parity:** ✅ Google Sign-In UI, server onboarding, real Student ID
- **Store release:** M-053 after Web GA (M-073)

## E. Deploy safety (P0 detail)
Prod = `main` @ repo root (old structure). The monorepo migration would break the Vercel build unless Root
Directory → `apps/web` (your dashboard action). So P0 ships ONLY the **additive backend** on a branch off
`main` (root structure): new routes `catalog`/`campus`/`class`/`next-lesson`/`lesson`(hw fallback),
token-auth additions in `lib/auth.ts` + `/api/auth/*`, `/api/progress` (Bearer + `recentGames` + data-merge),
and the `progress.data` column. Verified with web typecheck+build+e2e; pushed as a branch so Vercel's
**preview deploy** confirms web before you merge. The full monorepo migration is a separate, scheduled step.
