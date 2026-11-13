# ChessSchool v2 — Phase 4: polish

Goal: the app should feel as finished as chess.com or Duolingo, so it can carry a freemium plan later. Colours, fonts and Cody stay as they are; everything around them gets tightened.

## 1. Game and board

| Area | Now | Target |
|------|-----|--------|
| Board size | Inside a padded card, ~87% of the phone width, empty bands above and below | Edge to edge on phones and mobile web; player bars touch the board; strip, Cody line and actions fill the space underneath |
| Moving | Tap, tap | Tap or drag; the dragged piece lifts and follows the finger, legal squares glow, an illegal drop springs back |
| Capture | Sound only | The taken piece's silhouette pops off and flies to the captured tray |
| Check | Static red glow | Pulsing red ring on the king, a short board nudge |
| Checkmate | Result sheet | King tips over, board dims, a stamp, then the result sheet rises |
| Promotion | Bottom sheet in Gym only; puzzles and lessons auto-queen | Inline column of Queen / Rook / Bishop / Knight on the promotion square in every mode; a gold flash when the piece changes |
| Sound | One knock per move type | Layered knocks with pitch variation, a capture thud, check chime, mate and promotion phrases |

## 2. Layout and motion system

- One spacing scale (4-pt) for screen padding, card padding, gaps, and section spacing; applied to every screen.
- Shimmer skeletons shaped like the screen they stand in for (cards, rows, the board).
- Page transitions (slide on native stack, fade-up on web), staggered list entry, press scale on every tappable.
- Native animation on Reanimated 4 (new architecture on).
- Screen-reader labels, focus order and 56-pt targets re-checked.

## 3. Characters

- Cody's 13 animations rebuilt with eased keyframes, squash and stretch, blinking and idle breathing.
- Six bots get animated Lottie avatars (idle, thinking, happy, upset) that react to good moves, blunders and the result.

## 4. Content

- **Puzzles:** our own. `packages/chessschool-chess/scripts/mine-puzzles.mjs` plays the bots against each other, finds positions with one clearly best move (mate, fork, pin, winning material, promotion), checks the line with the engine, and rates it. Puzzles live in the API (`cs_puzzles`); the app downloads a pack and caches it for offline use. The Lichess data and credit are removed.
- **Lessons:** served from the API (`/v1/content/lessons`) with the bundled copy as the offline fallback; units extended, every lesson ends with a short recap and a check.
- **Copy:** every screen edited for tone, length and clarity.
- **Piece sets:** ChessSchool's own sets redrawn with cleaner silhouettes; three Lichess sets kept (Heritage, Spatial, Cartoon).

## 5. Freemium-ready (off)

A plan sheet, "Plus" badges and locked states for extra content, behind `FEATURES.plus = false`. No payments.
