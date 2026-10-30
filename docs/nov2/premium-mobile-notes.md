# Nov 2 premium mobile screens

Cut from `rc/nov2` at `1038cdf`. Premium is the default kit. Classic screens stay when `settings.uiKit` is `classic`.

390px Expo web shots and the matching design PNGs are artifacts, not files in this repo.

## Screens

- 03 map: normal, dark, loading, empty, error, offline. Gym is a Learn-rail row, not a tab. Review badge uses the due-lesson count.
- 20 Review tab and 10a `/review/queue`: due skills, needs-practice under 60% mastery. Start opens fix-mistakes when the mistake log has rows, otherwise the first due lesson. Match history stays on the tab.
- 04 class detail: same lesson and exam navigation as the journey screen.
- 09 class exam: premium shell on `lesson.exam` (close, pips, coach, board, pass-mark chip, hints off, lock-in bar). Moves still go through the lesson player. Seeded frame: `SEEDED_EXAM` in `premiumFixtures.ts` (knight on d5, puzzle 4 of 6). Preview: `/dev/premium-preview?id=09-class-exam` with `EXPO_PUBLIC_PREMIUM_PREVIEW=1`. `APP_VARIANT=production` redirects home.
- 10b fix mistakes: story of the played move, then the existing retry. Seeded frame: `SEEDED_MISTAKE` (knight a7, queen a2, progress 33%). Preview: `/dev/premium-preview?id=10b-fix-mistakes`.
- 11 Gym at `/gym` from Learn. 18 empty, error, and offline sheets use `KitSheet`.

The design preview route is `app/dev/premium-preview.tsx`. It stays closed unless `EXPO_PUBLIC_PREMIUM_PREVIEW=1`, and `APP_VARIANT=production` always redirects home.

Pass mark is `ceil(steps * 0.67)` (`examPassMark` / `EXAM_PASS_RATIO`). Six puzzles need five.

## Gaps

- Preview streak and XP chips are 0 because that session has no progress snapshot.
- Learn tab uses the kit book icon. The HTML draws a house.
- Gym puzzle tiles are a tint, not a mini board. The library payload has no FEN.
- Class detail overline is the lesson count. The class payload has no stage index.
- `loader.json` is vector-only (`assets` is empty), so the mobile bundle does not ship a loader still.

## Expo web dev shim (not in this branch)

Android and production bundles do not use it. `metro.config.js` on this branch is the rc/nov2 file.

For local Expo web screenshots only, you can temporarily point web resolution of `@lottiefiles/dotlottie-react` at a one-file stub that exports `DotLottieReact` as a no-op, and pin `react` / `react-dom` to `apps/mobile` when `platform === "web"` and `NODE_ENV !== "production"`. Do not commit it.

Remove that local edit by checking out `apps/mobile/metro.config.js` from this branch and deleting any untracked `src/shims/dotlottie-react.web.js`.
