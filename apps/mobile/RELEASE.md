# ChessSchool Mobile — Release & OTA Playbook

Android-first guide for EAS Build, EAS Update (OTA), and Google Play Store submission.

## Prerequisites (one-time)

1. **Expo account** — [expo.dev](https://expo.dev) (free tier: 30 EAS builds/month).
2. **EAS CLI** — `npm install -g eas-cli` then `eas login`.
3. **Link project** (required before first build — replaces placeholder project ID):

   ```bash
   cd apps/mobile
   eas init
   eas update:configure   # writes updates.url into app.json
   ```

4. **Google Play Console** — developer account verified ($25).
5. **Privacy policy live** — `https://chess-school.in/privacy`
6. **Production API** — `https://chess-school.in` (set in `eas.json` for all release profiles).
7. **Google Sign-In (native)** — see [Google OAuth setup](#google-oauth-setup-native) below and **`docs/ENV.md`** for the full variable checklist (Vercel + EAS + local `.env`).

---

## Google OAuth setup (native)

The web client ID (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`) is **not** valid as an Android/iOS client. Using it causes **Access blocked: Authorization error**.

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (same project as web):

### Android OAuth client (required for the native account picker)
- Application type: **Android**
- Package name: `com.chessschool.app`
- SHA-1 for **local Gradle release APKs** (current `android/app` debug keystore used for release signing):
  `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- SHA-1 for **EAS preview/production** Android builds (Expo keystore `tsgLua-5VY`):
  `82:BD:4A:17:CD:02:F0:68:E6:FB:98:B4:F6:7A:08:8D:33:A2:E4:A8`
  Add this as a **second** Android OAuth client (same package `com.chessschool.app`, this SHA-1) — Google Cloud does not merge fingerprints onto one client.
- The app uses **`@react-native-google-signin/google-signin`** (in-app account picker, not an external browser).
- In the app / EAS env you still set **`EXPO_PUBLIC_GOOGLE_CLIENT_ID`** to the **Web** client ID (needed for the ID token). Creating the Android client in Google Cloud with package + SHA-1 is what authorizes the APK — you do **not** paste the Android client ID over the Web client ID.

### iOS OAuth client (when shipping iOS)
- Application type: **iOS**
- Bundle ID: `com.chessschool.app`
- Copy the **iOS client ID** → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- Add the plugin option `iosUrlScheme` (reversed iOS client ID) if you ship an iOS build.

### Server (Vercel)
Ensure `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` includes the **Web** client (token `aud`). Optionally add `GOOGLE_ANDROID_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` for extra audiences. See `apps/web/.env.example` and `docs/ENV.md`.

Putting the **Web** client ID into `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` breaks sign-in — those must be platform-native clients when used.

Rebuild the native app after changing Google OAuth env vars or adding the Google Sign-In plugin (`eas build` / local Gradle). OTA JS updates are not enough.

---

## Release channels

| Channel | Build profile | Use |
|---------|---------------|-----|
| `development` | `development` | Dev client + simulator |
| `preview` | `preview` | Internal APK for device QA |
| `production` | `production` | Play Store AAB + OTA to store users |

**Runtime version:** tied to `app.json` → `expo.version` (`0.2.0`). Bump `version` when you ship a **native** change (new native module, SDK upgrade). JS-only fixes go out via **OTA** without a store update.

---

## Pre-flight checklist

Run before every store build:

```bash
cd apps/mobile
pnpm release:check    # typecheck + unit tests + expo-doctor
```

Manual QA on a **preview APK** (not dev client):

- [ ] Login / register / guest mode
- [ ] Complete a lesson, sync progress when logged in
- [ ] Bot game + pass-and-play
- [ ] Account → Privacy policy opens in browser
- [ ] Account → Delete account (use a throwaway test account)
- [ ] Offline banner appears when airplane mode on
- [ ] No internal API URLs or debug text in UI

---

## Build workflow

### 1. Internal preview (APK)

```bash
cd apps/mobile
pnpm build:android:preview
```

Install the APK from the Expo build page on a physical Android device.

### 2. Production AAB (Play Store)

```bash
cd apps/mobile
pnpm build:android:prod
```

- Output: **Android App Bundle** (`.aab`)
- `versionCode` auto-increments via EAS (`autoIncrement: true`)
- First build: EAS generates the upload keystore — **save credentials in Expo dashboard**

### 3. Submit to Play Console

**Internal testing track** (recommended first):

```bash
pnpm submit:android:internal
```

Or upload the `.aab` manually: Play Console → Release → Testing → Internal testing.

**Production track** (after internal QA passes):

```bash
pnpm submit:android:store
```

---

## OTA updates (EAS Update)

Ship JavaScript/asset fixes **without** a new Play Store review:

```bash
cd apps/mobile

# Staging channel (preview builds)
pnpm update:preview -- --message "Fix lesson retry copy"

# Store users (production channel — must match production build channel)
pnpm update:production -- --message "Fix campus load error"
```

Users see **“Update ready — tap to restart”** at the top of the app after the bundle downloads.

### When OTA is enough vs when you need a new store build

| Change | OTA | New AAB |
|--------|-----|---------|
| UI copy, styles, lesson logic (JS) | ✅ | |
| New npm dependency with **no** native code | ✅ | |
| New native module, permission, SDK bump | | ✅ |
| `app.json` version bump for store listing | | ✅ |
| Icon / splash / adaptive icon | | ✅ |

---

## Google Play Store listing (Phase 2)

Fill in Play Console while verification completes:

| Field | Value |
|-------|-------|
| App name | ChessSchool |
| Short description | Graduate through chess classes, puzzles, and matches. |
| Privacy policy URL | `https://chess-school.in/privacy` |
| Category | Education |
| Content rating | Complete IARC → likely Everyone |
| Target audience | 13+ (accounts + online play) |
| Data safety | Email, name, gameplay progress; encrypted in transit; deletion available |

**Assets needed:**

- App icon 512×512 (from `assets/icon.png`)
- Feature graphic 1024×500
- Phone screenshots × 4–8 (1080×1920): Learn, lesson, play, profile

**Review notes:** Provide a test account email/password for Google reviewers.

---

## Version numbering

- **`app.json` → `version`** — user-visible semver (`0.2.0`). Bump for store releases.
- **`android.versionCode`** — integer; EAS auto-increments on production builds.
- **`runtimeVersion`** — `appVersion` policy: OTA updates only apply to builds with the same `expo.version`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `No Next.js` / monorepo build fails on Vercel | Web only — mobile uses EAS, not Vercel |
| EAS build can't resolve `@chess-school/core` | Run build from `apps/mobile`; pnpm workspace is auto-detected |
| EAS Gradle / KSP failure (`IncompatibleClassChangeError`, kotlin metadata) | Do **not** set `expo-build-properties.android.kotlinVersion` — let Expo SDK 54 pick the toolchain. Keep `gradleCommand` + `GRADLE_OPTS` with configure-on-demand off |
| Preview APK instant crash on open | Pin Expo SDK-compatible natives (`expo-speech@~14` for SDK 54). Rebuild after `expo install` — stale wrong ABI builds crash at module load |
| OTA not applying | Run `eas update:configure`; production build must use `channel: production` |
| Updates disabled in dev | Expected — OTA only runs in release builds |
| Play rejection: missing deletion | Account screen → Delete account |
| Play rejection: privacy | Ensure `/privacy` is deployed on production |

---

## Command reference

```bash
cd apps/mobile

eas login
eas init
eas update:configure
pnpm release:check
pnpm build:android:preview
pnpm build:android:prod
pnpm submit:android:internal
pnpm submit:android:store
pnpm update:production -- --message "Your changelog"
eas build:list
eas credentials
```
