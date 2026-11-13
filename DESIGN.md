# ChessSchool v2 — design system

The new ChessSchool (`apps/chessschool`, `apps/chessschool-web`) keeps the production identity — indigo brand, soft lavender-white ground, Fredoka, tactile pill buttons — and adds Cody (Storybook × Clay), a visible rank curve, and a light game layer (XP, levels, streak). Premium and calm first; game feel second.

All values live in `packages/chessschool-design/src`. Never hard-code a colour or string in an app.

## Colour

Two palettes, `light` (default) and `dark` (production "midnight"), chosen by the learner's Appearance setting (`system` / `light` / `dark`). Every text/background pair is checked against WCAG AA in `tokens.test.ts`.

| Role | Light | Dark | Use |
|------|-------|------|-----|
| `bg` | `#FBFAFF` | `#14152B` | App background |
| `card` | `#FFFFFF` | `#1D1F3A` | Cards, sheets, tab bar |
| `sunken` | `#F1F0F9` | `#262947` | Wells, tracks, segmented controls |
| `line` | `#E7E6F2` | `#343760` | Hairlines |
| `text` / `textMuted` | `#1C1B2E` / `#5E5C78` | `#EDEDF6` / `#B4B3CF` | Body / secondary |
| `brand` / `brandEdge` | `#5B5BD6` / `#3B35A0` | `#6363E0` / `#34308F` | Primary action fill / pressed edge |
| `brandSoft` / `brandText` | `#EEF0FF` / `#4B46C4` | `#2A2F57` / `#B3B8FF` | Selected surfaces / brand text |
| `accent` | `#FF7A59` | `#FF8A6B` | Streak spark, Practice |
| `success` / `successText` | `#10B981` / `#047857` | `#34D399` / `#5EE3B0` | Done, saved |
| `danger` / `dangerText` | `#F43F5E` / `#BE123C` | `#FB7185` / `#FF9AAA` | Destructive, errors |
| `gold` / `goldText` | `#F6C343` / `#8A6100` | `#F6C343` / `#F8D375` | XP, achievements, Club |

Colour roles, not hues: brand = "do this", success = "done", gold = "earned", accent = "streak". Locked path rows keep a soft tint so a locked future still looks warm.

**App themes** (Phase 3, Settings → Looks): Classroom is the table above. Garden, Sunset, Library and High contrast are light palettes; Ocean and Midnight are dark (`THEMES` / `themePalettes` in `tokens.ts`). Each theme fills every role above plus its own board colours, and passes the same AA tests. Web sets `data-cs-theme` on `<html>` from a boot script before first paint; native passes the theme to `ThemeProvider`. The 8 app icons (`APP_ICONS` in `mascot.ts`) are Cody on a theme-coloured ground.

## Type

Fredoka, four weights (400/500/600/700). Web loads it with `next/font`; native with `@expo-google-fonts/fredoka`.

| Role | Size/line | Weight |
|------|-----------|--------|
| `hero` | 32/38 | bold |
| `title` | 26/32 | bold |
| `heading` | 20/26 | semibold |
| `bodyLg` | 18/26 | medium |
| `body` | 16/24 | regular |
| `label` | 16/20 | semibold |
| `small` | 14/20 | regular |
| `micro` | 12/16 | medium |

Sentence case everywhere. No tracked all-caps labels. Web sizes are `rem` (browser zoom/text size); native text scales with Dynamic Type (titles capped at 1.4×, body at 1.8×).

## Shape, space, touch

- Radius: `sm 8 · md 14 · lg 20 (cards) · xl 28 (sheets) · pill` (buttons, chips).
- Space: 4-pt scale (`space` token). Screen padding 16 (phone), 32 (tablet), 48 (desktop).
- Every control is at least **56 pt** tall (`minTarget`); icon buttons 48 with hit slop.
- Buttons are pills with a 4 px darker edge underneath; pressing drops them 3 px (`.btn-primary:active`, native `translateY`).

## Layout

| Surface | Width | Navigation |
|---------|-------|------------|
| Phone / mweb | 0–767 | Bottom tab bar: Learn · Puzzles · Gym · Profile |
| Tablet web | 768–1199 | 96 px icon rail |
| Desktop web | 1200+ | 264 px rail with wordmark + "Save your progress" card; content max 1120 px; Today splits 1.5fr / 1fr |

Full-screen flows (welcome, orientation, auth, status) are a single 560 px column with the primary action pinned to the bottom (thumb zone).

**Screen chrome** (`components/ui.tsx` in both apps):

- **Header:** sticky at the top. It's transparent at rest and gets the card colour plus a hairline once the page scrolls. Tab screens (Gym, Puzzles, Profile) use the `large` variant: a big title in the page that hands over to a small centred title as it scrolls away.
- **Primary action:** a screen whose main action sits at the end (game setup, Practice, a Club room) docks it in a floating bar just above the tab bar (web `ActionDock`, native `Page footer`), with a soft fade behind it.
- **Bottom sheets** replace inline forms and long lists (edit name, daily goal, all achievements, moves, game result). They have a grip you can drag or swipe down to close, open at most 88% of the screen, and scroll inside.
- **Save banner:** a one-line strip ("Keep your progress on every device", Sign up) for guests instead of a full card.

**Profile:** a "me" card (avatar, name with an edit button, rank, Member/Guest, rank progress), a 6-stat grid, an achievements strip with "See all", and a Preferences list (Name, Daily goal, Looks, Settings).

## Cody (mascot)

Storybook × Clay: a matte clay indigo pawn with a soft outline, bead eyes behind round glasses, freckles, a mustard yarn tassel and a little red book. Generated vector rig — `packages/chessschool-design/scripts/cody.mjs` → `assets/lottie/cody/*.json` + `assets/svg/cody.svg`. Thirteen animations:

| Animation | Where it's used |
|-----------|-----------------|
| `idle` | Today header (before first lesson), profile avatar fallback |
| `wave` | Splash, welcome step 1, log in (book in hand) |
| `reading` | Today hero before a lesson (page turns) |
| `thinking` | Welcome step 2, orientation beat 2, bots thinking, delete-account sheet |
| `happy` | Welcome step 3, Today header after a lesson, sign up |
| `celebrate` | Welcome step 4, orientation done, "progress saved" ceremony |
| `proud` | Orientation beat 3, Today hero after a lesson, Practice |
| `love` | Club, profile save banner |
| `oops` | Auth errors, 404 |
| `sad-soft` | Reset sheet, error screen |
| `sleepy` | Reminder sheet, offline page |
| `giggle`, `wow` | Gym (check, wins) and Puzzle sprint |

Cody appears at key moments, never in settings lists. Rive rebuild brief: `packages/chessschool-design/README.md`.

## Board & pieces

Board colours are tokens (`board*` in each palette): lavender light squares and indigo dark squares in Classroom (each theme has its own), gold for the selected piece, warm cream for the last move, mint rings for hints, a red glow for check, and soft dots/rings for legal moves. Squares are full-size tap targets with spoken labels ("e4, white knight, can move here"). The last move slides 220 ms, a miss shakes 360 ms; both are skipped with reduced motion.

**The table:** every board screen is one card, with Cody or the opponent on top, the board in the middle and you at the bottom, actions underneath. The board is the largest square that fits the space left (web container queries, native `onLayout`), so it grows on tall screens instead of sticking to the top.

**Game screen:** fixed-height rows (player bars, a one-line move strip, Cody's status line, actions), so nothing shifts as moves are played. Captured pieces sit on a small board-light chip under each player with a green "+N". Analysis uses the same table with an evaluation bar and an advantage graph in the board's own light and dark colours, and red (played) / green (better) arrows.

**Piece sets** (`packages/chessschool-chess/src/pieceSets.ts`): ChessSchool's own Toy (default: chunky rounded pieces on a 100-unit grid, cream with ink outlines for White, deep indigo for Black), Clay, Outline (highest contrast) and Pixel (Toy resampled to a 16×18 grid), plus six sets kept from the old app: Spatial, Arcade, Bold, Heritage, Cartoon, Fantasy (Lichess artwork; SVG on web, PNG on native). Coordinates, legal-move dots and promotion choice are learner settings.

## Motion

Tokens in `motion`: tap 140 ms, base 240 ms, slow 420 ms, ceremony 1100 ms, splash 1500 ms; ease-out `(0.16,1,0.3,1)`, spring `(0.34,1.56,0.64,1)`.

Ceremonies are earned, never decorative: XP pop + stamp + level-up chime on finishing a lesson; stamp + celebrate on "progress saved". No confetti on taps.

**Reduced motion** (OS setting): every Lottie stops on a designed poster frame (`codyPoster`), CSS animations and transitions collapse to 0, native uses `AccessibilityInfo.isReduceMotionEnabled`.

## Sound & haptics

Eleven synthesised cues (`scripts/sounds.mjs`, original, no samples). UI: `tap`, `success`, `stamp`, `gentle-no`, `level-up`. Chess: `move` (a soft wooden knock), `capture`, `check` (knock + chime), `castle` (two knocks), `promote` (knock + rising bells), `low-time` (two ticks under 10 seconds). On by default, toggled in Settings, from the game header, or in the moves sheet. Native pairs each with a haptic (light impact for moves, medium for captures, heavy for check, success for promotion, warning for low time); web has no haptics. Native respects the silent switch and mixes with the learner's music.

## Copy voice

Warm, short, specific — a good teacher. CTAs name the action ("Begin", "Save my progress", "Clear this device"). Locked things say why ("Arrives in the next update."). Errors say what happened and what to do ("That email and password don't match. Try again, or create an account."). All strings: `packages/chessschool-design/src/copy.ts`.

## Accessibility

- AA contrast enforced by test, both schemes.
- Every control has a role and label; locked path rows announce "<title>, locked. <reason>"; the rank curve and goal ring have text alternatives.
- Web: skip link, `<dialog>` sheets, focus moves to each step's heading, arrow keys in segmented controls.
- Native: `accessibilityRole` on tabs/radios/switches, `accessibilityViewIsModal` sheets, live regions for toasts and ceremonies.
