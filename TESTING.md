# ChessSchool v2 — internal testing

How to put the new app in front of a few testers. Nothing here submits to a store.

## Builds

| Platform | Build | Notes |
|----------|-------|-------|
| Android | `cd apps/chessschool && npx eas-cli build --profile preview --platform android` | Internal APK (channel `preview`). Share the EAS install link; testers allow "install unknown apps". |
| iOS | `npx eas-cli build --profile preview --platform ios` | Ad-hoc: each tester's device must be registered first (`npx eas-cli device:create`). TestFlight needs a store build, so only when asked. |
| Web | Deploy `apps/chessschool-web` as its own Vercel project (not the live `apps/web`) | Set `CHESSSCHOOL_API_URL`, `NEXT_PUBLIC_APP_URL`, and optionally `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. |

- **Accounts need the new API.** Set `EXPO_PUBLIC_API_URL` in EAS env (preview only) to the hosted `apps/chessschool-api`. Never point it at `https://www.chess-school.in`. Without it the app runs fully as an on-device guest, which is fine for a first round.
- Preview builds are real native builds, so **app icons, daily reminders and Google sign-in** work there (they don't in Expo Go).

## What to ask testers to try

1. Fresh install: welcome, placement card, the first lessons.
2. Learn: finish a unit; check the achievement toast.
3. Puzzles: a few rated puzzles, the daily puzzle, one sprint.
4. Gym: a game against two different bots, pass & play with a clock, then Review games.
5. Settings → Looks: a theme, a piece set, an app icon.
6. Leave for a day: does the reminder arrive, and does Learn say "You came back"?
7. Create an account, sign in on a second device, check progress followed.
8. Settings → Send feedback with anything odd.

## Reading feedback

Messages land in the `cs_feedback` table of the new database (mood, message, guest ID or user ID, platform, version, theme, piece set). Locally: `apps/chessschool-api/local.db`.

## Before a wider or public release

- Confirm the licences of the six retained Lichess piece sets (`packages/chessschool-chess/assets/pieces/ATTRIBUTION.md`).
- Decide the freemium plan.
- Verify on iOS.
