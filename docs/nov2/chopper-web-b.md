# nov2/chopper-web-b — Review, Gym, Play, sheets, admin import

Built on `nov2/zoro-web-kit-rc` (`2c139c3`), which is the Premium Illustrated kit rebased onto `rc/nov2` (`b30c2af`). Screens use the kit shell (sidebar at ≥1024px, bottom tabs below), kit tokens, and kit components (`Button` patterns via `.btn`, `ProgressBar`, `CoachAvatar`, `Logo` assets). Legacy UI stays on `uiKit === "legacy"`.

Each comparison image is the app on the left and the Premium Illustrated HTML on the right. `?fixture=1` pins the design's sample mastery and solved flags. Without it, review and gym read lesson mastery from the progression store.

## Screens

| Screen | Route | 390 | 1280 |
| --- | --- | --- | --- |
| 20 Review tab | `/review` | [390](chopper-web-b/20-review-tab-390.png) | [1280](chopper-web-b/20-review-tab-1280.png) |
| 10a Review queue | `/review/queue` | [390](chopper-web-b/10a-review-queue-390.png) | [1280](chopper-web-b/10a-review-queue-1280.png) |
| 10b Fix mistakes | `/practice/mistakes` | [390](chopper-web-b/10b-fix-mistakes-390.png) | [1280](chopper-web-b/10b-fix-mistakes-1280.png) |
| 11 Gym | `/gym` (Learn stays the active tab) | [390](chopper-web-b/11-gym-390.png) | [1280](chopper-web-b/11-gym-1280.png) |
| 12 Play hub | `/play` | [390](chopper-web-b/12-play-hub-390.png) | [1280](chopper-web-b/12-play-hub-1280.png) |
| 12 Match (Kira) | `/play?scene=kira` | [390](chopper-web-b/12-play-match-390.png) | [1280](chopper-web-b/12-play-match-1280.png) |
| 12 Match Ash | `/play?scene=ash` | [390](chopper-web-b/12-play-match-ash-390.png) | [1280](chopper-web-b/12-play-match-ash-1280.png) |
| 12 Match Rex | `/play?scene=rex` | [390](chopper-web-b/12-play-match-rex-390.png) | [1280](chopper-web-b/12-play-match-rex-1280.png) |
| 12 Match Skye | `/play?scene=skye` | [390](chopper-web-b/12-play-match-skye-390.png) | [1280](chopper-web-b/12-play-match-skye-1280.png) |
| 12 Match dark | `/play?scene=dark` | [390](chopper-web-b/12-play-match-dark-390.png) | [1280](chopper-web-b/12-play-match-dark-1280.png) |
| 12 Won | `/play?scene=won` | [390](chopper-web-b/12-play-won-390.png) | [1280](chopper-web-b/12-play-won-1280.png) |
| 12 Lost | `/play?scene=lost` | [390](chopper-web-b/12-play-lost-390.png) | [1280](chopper-web-b/12-play-lost-1280.png) |
| 17 Admin import | `/admin/import` (admin). Visual fixture: `/dev/chopper/admin-import` | [390](chopper-web-b/17-admin-import-390.png) | [1280](chopper-web-b/17-admin-import-1280.png) |
| 18 Empty | `/gym?sheet=empty` | [390](chopper-web-b/18-sheet-empty-390.png) | [1280](chopper-web-b/18-sheet-empty-1280.png) |
| 18 Error | `/gym?sheet=error` | [390](chopper-web-b/18-sheet-error-390.png) | [1280](chopper-web-b/18-sheet-error-1280.png) |
| 18 Offline | `/gym?sheet=offline` | [390](chopper-web-b/18-sheet-offline-390.png) | [1280](chopper-web-b/18-sheet-offline-1280.png) |

Per-side files are `*-app.png` and `*-design.png` next to each composite.

## Wiring

- Review skills map onto real lessons (`fork-master`, `pin-it`, `knight-hops`, `mate-in-one`, `pre-pieces-king`, `pre-moves-castling`). Mastery and the Review badge come from the progression store. Unseen skills count as due.
- Fix mistakes shows the newest mistake FEN. **Next** opens the existing mistake `LessonPlayer` at `/practice/mistakes?play=1`.
- Gym lists those curriculum puzzles, filters by skill and level, and links **Solve it** to `/lesson/[id]`.
- Play hub starts the existing match store (`bot` for Coach/Bot, `pass` for Friend) at the opponent's ELO (Skye 600, Kira 1100, Rex 1800, Ash 2000). A live game uses `ChessBoard` and `getBotMove`, then `saveGame`.
- Admin import validates rows in the browser and publishes through the existing `importPuzzleJsonl` action. No backend change.

## Remaining differences

- **Shell.** The kit sidebar keeps Search and the streak/level footer. The HTML designs use a glow logo and streak/XP chips in the top bar, and no search row. The kit doc already kept that search row.
- **Coach art.** `design/premium/` is not in this checkout. Mood busts, head crops, accent overlays, and Lottie faces from the HTML (`../assets/coaches`, `../assets/dex`) are missing. Portraits are the shipped `/coaches/*-premium.webp` files. The design captures show empty glow frames where those files 404.
- **Pieces.** Gym and fixture boards use `/pieces/cburnett`. The HTML inlines its own piece symbols, so mini-boards are not identical.
- **Review tab** also lists **Match history** under the design layout so saved games still open.
- **XP.** A live win still awards 40 XP, matching the current client rule. The design copy says 50 on a win and 20 on a loss; those numbers show on the fixture scenes.
- **Admin table.** The sample is the six rows drawn in the design, with live counts (6 / 3 / 1 / 2), not the design's 120-row summary. Publish is disabled until an admin picks a class. The screenshot route does not require a login.
- **Ash control** is an On/Off chip, not the design's sliding switch.
- **Live match board** is `react-chessboard`. Fixture scenes use a static mini-board so the position is visible without the dynamic chessboard chunk.
- **Coordinates** on the fixture match board are not drawn. The design prints file and rank letters on the squares.
