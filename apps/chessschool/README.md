# chessschool (native)

ChessSchool v2 for iOS and Android — Expo SDK 54, Expo Router 6, `newArchEnabled: false`. Same store identity as the published app: `com.chessschool.app`, EAS project `af6d1946-…`, owner `shaileshjha200`, slug `chess-school`, scheme `chessschool`. Version 0.4.0, Android versionCode 30, iOS buildNumber 3.

```bash
pnpm --filter chessschool sync-assets      # copy store icons from the design package
EXPO_PUBLIC_API_URL=http://10.0.2.2:3300 pnpm --filter chessschool start   # Android emulator
EXPO_PUBLIC_API_URL=http://localhost:3300 pnpm --filter chessschool start  # iOS simulator
pnpm --filter chessschool e2e:android      # Phase 1 walkthrough on a running emulator (Expo Go, Metro on :8083)
bash scripts/phase3-android.sh             # Phase 3 checks: Gym, Puzzles, Looks, achievements
```

Start Metro without `CI=1` when iterating: `CI=1` turns off file watching, so edits only appear after a Metro restart.

## Expo Go vs a native build

Everything runs in Expo Go 54 except **Google Sign-In**, which needs `@react-native-google-signin/google-signin` compiled in. In Expo Go the Google button hides itself. Build a dev client to test it:

```bash
npx eas-cli build --profile development --platform android
```

A native rebuild is also needed after changing Google client IDs or adding native modules. Expo Go warns that it always uses the New Architecture; store builds keep `newArchEnabled: false` as required.

## Environment (EAS env, not committed)

| Variable | Notes |
|----------|-------|
| `EXPO_PUBLIC_API_URL` | The **new** API. Not set in `eas.json` on purpose; without it the app runs fully as an on-device guest |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Web client ID (ID-token audience) — in `eas.json` |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android client (package + SHA-1s from `apps/mobile/RELEASE.md`) |

## Release

Same pipeline as 0.3.2: `pnpm --filter chessschool build:android:prod` (app-bundle, image sdk-54, medium, autoIncrement, channel production) then `submit:android:internal` (track internal, draft). Not run automatically — store submission happens only when asked, after Phase 2.

## App icons

Eight alternate icons (`assets/app-icons`, copied by `sync-assets`) are registered by the `expo-alternate-app-icons` config plugin in `app.json`. Switching needs a development or store build; in Expo Go the Looks screen explains that instead. After changing an icon, rebuild natively.

## Daily reminders

Reminders are local notifications scheduled for the next 7 days at the chosen hour (`lib/notifications.ts`), re-planned whenever progress or settings change; today is skipped once the goal is met. Expo Go cannot schedule them reliably (and logs an error when `expo-notifications` loads), so the app skips scheduling there — use a development or store build (`eas build --profile development`) to test reminders. No native rebuild beyond the existing `expo-notifications` plugin is needed.
