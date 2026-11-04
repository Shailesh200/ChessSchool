# ChessSchool v2 — Phase 3 (looks, Gym, Puzzles, internal testing)

Builds on [PHASE2.md](PHASE2.md). Navigation is now **Learn · Puzzles · Gym · Profile** (Rooms is gone; `/rooms` and `/rooms/play` redirect to `/gym`, Club stays at `/rooms/club`).

| Package | New in Phase 3 |
|---------|----------------|
| `packages/chessschool-chess` | 10 piece sets, a small alpha-beta engine, 6 bots, clocks, pass & play, Shuffle chess, start positions, promotion choice, game review, the puzzle pack + puzzle runner, Units 2–3, scripted "line" lesson steps |
| `packages/chessschool-design` | 7 app themes, 8 app icons, board prefs, puzzles/bots/placement in progress, game log, 14 achievements, Phase 3 copy and icons |
| `apps/chessschool-api` | `DELETE /v1/me` (real account deletion, new database only), `POST /v1/feedback` (guests too, 5 per 10 minutes per IP), `cs_feedback` table |

## Looks (Profile → Settings → Looks)

- **App themes:** Classroom (light or dark, follows Appearance), Garden, Sunset, Ocean, Midnight, Library, High contrast. Every text/background pair in every theme is checked for WCAG AA in `tokens.test.ts`. Web applies the theme before first paint (no flash); native re-themes live.
- **Piece sets:** ChessSchool's own Toy, Clay, Pixel and Outline, plus the six sets from the old app: Spatial, Arcade, Bold, Heritage, Cartoon, Fantasy. Web draws the original SVGs; native uses 192 px PNGs rasterised from them.
- **Board:** coordinates on/off, legal-move dots on/off, promotion "ask" or "always queen".
- **App icon:** 8 variants. Native switches the home-screen icon (`expo-alternate-app-icons`); web swaps the favicon. Expo Go can't change icons, so the picker explains that there.

## Board layout ("the table")

Every board screen (lessons, Gym, puzzles, review) puts the board on a card: Cody or the opponent on top, the board in the middle, you at the bottom, actions below. The board takes the largest square that fits, so it grows on tall phones and tablets; web uses container queries, native measures with `onLayout`.

## Gym

- **Bots:** Pip (1), Cody (2), Rooky (3), Professor Bishop (4), Queen Ivy (5), King Atlas (6). Levels 1–3 are rule-based with friendly mistakes; 4–6 search with the engine under a time budget, so they reply in about 1–2 seconds even on a phone. Take-backs are on for the first three.
- **Setup:** side (White, Black, random), clock (none, 10+0, 5+3, 3+2), take-backs.
- **Modes:** quick game vs Cody, pass & play (the board turns for each side), Shuffle chess (randomised back rank, no castling), and six start positions (queen vs king, rook vs king, and more).
- **Promotion:** choose the piece, unless Settings says always queen.
- **Game screen:**
  - Every row has a fixed height, so the board never moves as the game goes on.
  - The moves are one line under the board (newest on the right); tapping it opens the full list, with a move-sounds switch and Copy moves (Share moves on native).
  - Captured pieces sit under each player with the material lead (+N). The header speaker mutes sounds.
- **Sounds:** a soft wooden knock for a move, plus distinct sounds for a capture, check, castling, promotion and the last 10 seconds on your clock. Native adds a matching vibration. They follow the Sound setting.
- **Result sheet:** when a game ends, Cody, the result, an accuracy ring, counts of good moves, inaccuracies, mistakes and big mistakes, and the best moment. "See analysis" opens the analysis.
- **Analysis** (the last 30 games are kept):
  - An evaluation bar beside the board and an advantage graph with key moments marked; tap the graph or a moment to jump there.
  - Each move gets a card explaining it, with arrows on the board: red for what was played, green for Cody's better move.
  - "Try the better move" puts you back before the move to find it yourself; "Show me" reveals it.
  - It all runs on the device, one move at a time, so it works offline.

## Puzzles

- **Pack:** 1,520 puzzles from the Lichess puzzle database (CC0), rated 400–2000, bundled so they work offline.
- **Play:** puzzles near your rating (Elo-style, starting at 600), a hint, "Show answer", and the rating change after each one.
- **Daily puzzle:** the same one for everyone on a given day; it counts toward the streak.
- **Puzzle sprint:** 3 minutes, 3 mistakes; your best score is kept.
- **Themes:** Mate in one, Mate in two, Forks, Pins, Skewers, Free pieces, Discovered attacks, Back-rank mates, Promotion, Endgames, Defence, Sacrifices.

## Learn

| Unit | Lessons |
|------|---------|
| 1 · First steps | Meet the school, The board, How pieces move, Pawns & promotion, Check & checkmate, Your first game |
| 2 · Playing well | Castling, En passant & stalemate, What pieces are worth, Forks, Pins |
| 3 · Checkmate patterns | The ladder mate, Queen and king mate |

- **Placement:** a one-time card on Learn ("I'm brand new" / "I know how the pieces move" / "I already play games"). It skips the matching lessons (marked "Skipped", no XP) and sets a starting puzzle rating (750 or 1000).
- **Line steps:** a lesson can script a short sequence; you play your moves and Cody answers with the scripted replies (used for the mating patterns).

## Screens and flows

- **Sticky header** on every screen, firming up on scroll; Gym, Puzzles and Profile have a large title that shrinks into the header.
- **Floating primary action** above the tab bar on game setup, Practice and Club rooms.
- **Bottom sheets** you can swipe down: edit name, daily goal, all achievements, moves, game result.
- **Profile redesign:** me card, stat grid, achievements strip, Preferences list. The guest save card is now a one-line banner (Profile, Learn, Settings).
- The web Gym page no longer widens past the phone screen.

Layout rules: [DESIGN.md → Layout](DESIGN.md#layout).

## Internal-testing essentials

- **Achievements:** 14 badges on Profile (lessons, units, streaks, games, bots, puzzles, rating, Practice). A toast appears once when a badge is earned.
- **Feedback:** Settings → Send feedback: a mood (Love it / It's okay / Something's wrong) and a message, sent with the app version, platform, theme and piece set. Works for guests; read it from the `cs_feedback` table.
- **Delete account:** Settings → Delete account removes the user, sessions and progress from the new database and clears this device.
- **What's new** in Settings lists the Phase 3 changes. How to run a test round: [TESTING.md](TESTING.md).

## Adding content

| What | Where | How it's checked |
|------|-------|------------------|
| Lessons | `packages/chessschool-chess/src/lessons.ts` (steps: say, tap, move, stars, choice, game, line) + a path node in `packages/chessschool-design/src/progress.ts` (`PATH`, unit, XP) + titles in `copy.ts` | `chess.test.ts` solves every lesson step by step; a lesson that can't be finished fails the tests |
| Puzzles | `node scripts/build-puzzles.mjs [puzzles.csv.gz]` in `packages/chessschool-chess` (defaults to `data/chess-school-puzzles.csv.gz`) → `src/puzzles.data.ts` | Every move is replayed with chess.js while building; tests sample 300 and solve them |
| Piece sets | `pnpm --filter @chessschool/chess pieces` (copies the SVGs, rasterises the PNGs, regenerates `apps/chessschool/lib/pieceAssets.ts` and the Pixel set) | Piece-set tests check every set has all 12 pieces |
| App icons | `node scripts/app-icons.mjs` in `packages/chessschool-design`, then `sync-assets` in both apps | Visual check; native icons need a rebuild |

New lessons and puzzles ship with the app (no server content yet), so they reach testers in the next build or web deploy.

## Routes

| Screen | Web | Native |
|--------|-----|--------|
| Gym | `/gym` | `(tabs)/gym` |
| Game setup + game | `/play?bot=…&mode=friend\|shuffle\|position` | `play` |
| Review list + analysis | `/gym/review`, `/gym/review/[id]` | `review/index`, `review/[id]` |
| Puzzles | `/puzzles`, `/puzzles/solve?theme=…&daily=1`, `/puzzles/sprint` | `(tabs)/puzzles`, `puzzle`, `sprint` |
| Looks | `/settings/looks` | `looks` |

The service worker (`cs-v0.4.0-4`) precaches the new pages; bots, puzzles and review run on the device, so they work offline.

## Verify

```bash
pnpm cs:check                                     # typecheck 5 packages + 265 unit tests
node apps/chessschool-web/e2e/phase3.mjs /tmp/p3  # web walkthrough (web :3100 + API :3300)
node apps/chessschool-web/e2e/phase2.mjs /tmp/p2  # regression
node apps/chessschool-web/e2e/phase1.mjs /tmp/p1  # regression
bash apps/chessschool/scripts/phase3-android.sh   # Android emulator (Expo Go, Metro on :8083)
```

Passed on 2026-11-04:

- **Unit tests:** design 208 (contrast for every theme, merge, achievements, placement), chess 41 (every lesson, 300 sampled puzzles, every bot plays legal moves in time, clocks, promotion, pass & play, Shuffle chess, review, game summary, move sounds, Try the better move), API 16.
- **Web:** placement, all Unit 2–3 lessons, puzzles (solve, miss, show answer, daily, a theme), sprint, King Atlas replying with the board staying put, the move strip and moves sheet, muting, the result sheet, analysis (a known blunder shows both arrows, and Try the better move → Show me), pass & play with a 3+2 clock, the board turning and a resignation, Shuffle chess, Looks (Midnight, Heritage, coordinates off, Garden favicon, kept after reload), achievements, feedback, and deleting an account (logging in afterwards fails). Phase 1 and 2 walkthroughs still pass.
- **Android (Expo Go):** the four tabs, a puzzle with a hint, Professor Bishop replying, the moves sheet, the result sheet with accuracy, analysis, pass & play with a 3+2 clock and the board turning, Ocean theme with Heritage pieces, a lesson on the table, and achievements.

## Not done / limits

- **Freemium** is paused until the plan is chosen.
- **Piece-set licences:** the six retained Lichess sets have different licences (`packages/chessschool-chess/assets/pieces/ATTRIBUTION.md`); confirm each before a public store release.
- **App icons** and **scheduled reminders** need a development or store build; Expo Go can't do either.
- **iOS** isn't verified (no simulator on this machine).
- **Android sign-up in the Phase 1 script:** the emulator keyboard drops characters after "@" when adb types the email, so that step needs typing by hand. The form itself is unchanged.
- The bots are a small in-app engine (no Stockfish), so King Atlas is strong for beginners but not for club players. There's no online play.
- Lessons and puzzles are bundled; there's no server-side content or admin yet.
- **Not done since Phase 1:** API hosting and the new Turso database. Store builds and submission only when asked.
