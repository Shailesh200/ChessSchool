# chessschool (native)

ChessSchool v2 for iOS and Android — Expo SDK 54, Expo Router 6, `newArchEnabled: true`. Same store identity as the published app: `com.chessschool.app`, EAS project `af6d1946-…`, owner `shaileshjha200`, slug `chess-school`, scheme `chessschool`. Version 0.4.0, Android versionCode 37, iOS buildNumber 16.

```bash
pnpm --filter chessschool sync-assets      # copy store icons from the design package
EXPO_PUBLIC_API_URL=http://10.0.2.2:3300 pnpm --filter chessschool start   # Android emulator
EXPO_PUBLIC_API_URL=http://localhost:3300 pnpm --filter chessschool start  # iOS simulator
pnpm --filter chessschool e2e:android      # Phase 1 walkthrough on a running emulator (Expo Go, Metro on :8083)
bash scripts/phase3-android.sh             # Phase 3 checks: Gym, Puzzles, Looks, achievements
```

Start Metro without `CI=1` when iterating: `CI=1` turns off file watching, so edits only appear after a Metro restart. The `10.0.2.2` / `localhost` URLs above are local Metro overrides only. Every EAS profile, including `development`, bakes in `https://api.chess-school.in`, and the native app does not allow cleartext HTTP.

## Expo Go vs a native build

Everything runs in Expo Go 54 except **Google Sign-In**, which needs `@react-native-google-signin/google-signin` compiled in. In Expo Go the Google button hides itself. Build a dev client to test it:

```bash
npx eas-cli build --profile development --platform android
```

A native rebuild is also needed after changing Google client IDs or adding native modules. Reanimated 4 and react-native-worklets 0.5.1 require the New Architecture, so `newArchEnabled` is true (top-level and in `expo-build-properties`) for store builds. Expo Go uses the New Architecture as well.

## Environment (EAS env, not committed)

| Variable | Notes |
|----------|-------|
| `EXPO_PUBLIC_API_URL` | Every EAS profile sets `https://api.chess-school.in`. Cleartext is off (`android.usesCleartextTraffic: false`). Without the variable the app runs fully as an on-device guest |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Web client ID (ID-token audience) — in `eas.json` |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Present in `eas.json` and **unused by this app**. Native Google Sign-In reads only `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (`webClientId`) and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Android matching is the package name plus SHA-1 on that web client, not this env var. There is no `.env.example` in this app. |

## Release

Version codes live in `app.json` (Android versionCode 37, iOS buildNumber 16). `eas.json` uses `appVersionSource: local`, and the production profile does not auto-increment, so a Play build and a `qa-apk` build from this commit ship that same versionCode. Bundle id `com.chessschool.app`. Cleartext HTTP is off on every profile. Preview, production, and `qa-apk` all use `https://api.chess-school.in`.

- Play: `pnpm --filter chessschool build:android:prod` (app-bundle, image sdk-54, medium, channel production) then `submit:android:internal` (track internal, draft).
- iOS: `pnpm --filter chessschool build:ios:prod` (image sdk-54, medium). Submit profile `production` carries App Store Connect app `6828715695` and Apple Team `ARDSWV5GD2`. No Apple ID or password is stored in the repo.
- iOS without Google sign-in: profile `production-ios-nogoogle` extends `production`, and sets `CS_DISABLE_GOOGLE=1` (eas-cli rejects empty env values, so the client IDs stay set; with no Google native module the button is hidden). `app.config.js` then omits the Google plugin and any `googleusercontent` URL scheme. Other profiles are unchanged.
- QA smoke APK: `npx eas-cli build --platform android --profile qa-apk`. Same API URL, Google client ids, and versionCode as the Play profile, on channel `qa` so a production OTA cannot reach a QA build (or the reverse). `buildType` is `apk` (one universal APK, no ABI split) and `distribution` is `internal`, so it can be sideloaded. It is not a submit profile.

Not run automatically — store submission happens only when asked.

## App icons

Eight alternate icons (`assets/app-icons`, copied by `sync-assets`) are registered by the `expo-alternate-app-icons` config plugin in `app.json`. Switching needs a development or store build; in Expo Go the Looks screen explains that instead. After changing an icon, rebuild natively.

## Daily reminders

Reminders are local notifications scheduled for the next 7 days at the chosen hour (`lib/notifications.ts`), re-planned whenever progress or settings change; today is skipped once the goal is met. Expo Go cannot schedule them reliably (and logs an error when `expo-notifications` loads), so the app skips scheduling there — use a development or store build (`eas build --profile development`) to test reminders. No native rebuild beyond the existing `expo-notifications` plugin is needed.
