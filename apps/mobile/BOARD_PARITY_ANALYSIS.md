# Chess Board Web → Mobile Side-by-Side Analysis

Source of truth: `apps/web/features/board/ChessBoard.tsx` and how web callers drive it from `LessonPlayer` / `MatchView`.
Target: `apps/mobile/src/ChessBoard.tsx` and mobile lesson/play callers.

Runtime artifact captured:
- Mobile simulator clip: `/tmp/chessschool-board-mobile.mov`

Note: Playwright could drive the web board, but video recording was blocked because the local Playwright ffmpeg/browser assets are not installed. The code path still gives exact web behavior because the web uses `react-chessboard` with explicit `animationDurationInMs: 220`.

## Summary

The main mismatch was not just animation speed. Web board UX is a bundle of behaviors:

- 10px drag activation so small tap jitter does not become a drag.
- Built-in 220ms board position animation.
- Promotion chooser before submitting a promotion move.
- Translucent last-move/selected overlays.
- Inset-ring highlights for teaching squares, red wrong/check squares, and green success squares.
- Board card shadow.
- Callers pass the right transient state (`checkSquare`, `successSquare`, arrows, highlights, `lastMove`) at the right moment.

Mobile had a custom React Native board. It had piece slide animation and drag/tap support, but missed or differed in several of those behaviors.

## Side-by-side findings

| Area | Web behavior | Mobile before | Status after patch |
| --- | --- | --- | --- |
| Drag threshold | `dragActivationDistance: 10` | any movement became drag | matched with 10px threshold |
| Move animation | `animationDurationInMs: 220` | destination piece slides 220ms | kept; still custom, but closer |
| Promotion | q/r/b/n chooser overlay | auto-queen everywhere | chooser added; callers honor selected piece |
| Last move | translucent yellow | solid yellow | matched translucency |
| Selection | translucent green | solid green | matched translucency |
| Teaching highlights | purple inset ring | solid yellow fill | matched inset ring |
| Wrong/check | red inset ring | absent | `checkSquare` prop added and wired |
| Success | green fill + inset ring | absent | `successSquare` prop added and wired for lessons |
| Board surface | rounded + shadow card | rounded only | shadow added |
| Check in games | king square highlighted | absent | wired in bot/pass/online |
| Coordinates | optional `showNotation` | absent | still pending |
| Web full-board library animation | library animates position updates | custom destination-piece animation | acceptable first pass; deeper parity would need a board animation layer |

## Remaining board-specific work

1. Add optional coordinate notation (`a-h`, `1-8`) for review/play parity.
2. Consider a fuller position-diff animation layer if the current destination-piece slide still feels unlike `react-chessboard` in recordings.
3. Tune ghost drag size/opacity after manual simulator verification.
4. Wire `successSquare` / `checkSquare` into placement, school exam, and practice if we want the same success/error flash there too.
5. Add a web recording once Playwright ffmpeg/browser assets are installed locally.
