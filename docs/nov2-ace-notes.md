# Nov 2 ace screens

Branch `nov2/ace-map-review-rc`, cut from `rc/nov2` at `ba5ba67` (Dex TTF fonts and the Ussop lesson shell). Premium is the default kit. Classic screens stay when `settings.uiKit` is `classic`.

390px Expo web shots and the matching design PNGs are artifacts, not files in this repo: `/opt/cursor/artifacts/ace-shots/`. Each pair is `shots/<id>.png` next to `design/<id>.png`.

## Screens

- 03 map: normal, dark, loading, empty, error, offline. Gym is a Learn-rail row, not a tab. Review badge uses the due-lesson count.
- 20 Review tab and 10a `/review/queue`: due skills, needs-practice under 60% mastery. Start opens fix-mistakes when the mistake log has rows, otherwise the first due lesson. Match history stays on the tab.
- 04 class detail: same lesson and exam navigation as the journey screen.
- 09 class exam: premium shell on `lesson.exam` (close, pips, coach, board, pass-mark chip, hints off, lock-in bar). Moves still go through the lesson player. Seeded frame: `SEEDED_EXAM` in `aceFixtures.ts` (knight on d5, puzzle 4 of 6). Preview: `/ace-preview?id=09-class-exam` with `EXPO_PUBLIC_ACE_PREVIEW=1`.
- 10b fix mistakes: story of the played move, then the existing retry. Seeded frame: `SEEDED_MISTAKE` (knight a7, queen a2, progress 33%). Preview: `/ace-preview?id=10b-fix-mistakes`.
- 11 Gym at `/gym` from Learn. 18 empty, error, and offline sheets use `KitSheet`.

Pass mark is `ceil(steps * 0.67)` (`examPassMark` / `EXAM_PASS_RATIO`). Six puzzles need five.

## Gaps

- Preview streak and XP chips are 0 because that session has no progress snapshot.
- Learn tab uses the kit book icon. The HTML draws a house.
- Gym puzzle tiles are a tint, not a mini board. The library payload has no FEN.
- Class detail overline is the lesson count. The class payload has no stage index.

## Expo web dev shim (not in this branch)

Android and production bundles do not use it. `metro.config.js` on this branch is the rc/nov2 file.

For local Expo web screenshots only, you can temporarily point web resolution of `@lottiefiles/dotlottie-react` at a one-file stub that exports `DotLottieReact` as a no-op, and pin `react` / `react-dom` to `apps/mobile` when `platform === "web"` and `NODE_ENV !== "production"`. That avoids a missing optional peer and a second React copy during `expo start --web`. Do not commit it.

Remove that local edit by checking out `apps/mobile/metro.config.js` from this branch and deleting any untracked `src/shims/dotlottie-react.web.js`. Boa's web stub will replace it later.
