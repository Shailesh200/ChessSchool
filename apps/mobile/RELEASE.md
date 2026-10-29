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
6. **Production API** — `https://www.chess-school.in` (set in `eas.json` for preview/production; avoid apex — it 308s to www).
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
- If Play App Signing is on (default for Play uploads), also add a third Android OAuth client with the **App signing key** SHA-1 from Play Console → Setup → App signing (not only the upload/EAS key).
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

| Channel       | Build profile | Use                                 |
| ------------- | ------------- | ----------------------------------- |
| `development` | `development` | Dev client + simulator              |
| `preview`     | `preview`     | Internal APK for device QA          |
| `production`  | `production`  | Play Store AAB + OTA to store users |

**Runtime version:** tied to `app.json` → `expo.version` (`0.2.0`). Bump `version` when you ship a **native** change (new native module, SDK upgrade). JS-only fixes go out via **OTA** without a store update.

---

## Pre-flight checklist

Run before every store build:

```bash
cd apps/mobile
pnpm release:check    # typecheck + unit tests + expo-doctor
```

**Device feel (audio / haptics / Google / pieces):** complete [`DEVICE_CHECKLIST.md`](DEVICE_CHECKLIST.md) on a physical Android (Internal testing) before promoting a build.

Manual QA on a **preview APK** (not dev client):

- [ ] Login / register / guest mode
- [ ] Complete a lesson, sync progress when logged in
- [ ] Bot game + pass-and-play
- [ ] Account → Privacy policy opens in browser
- [ ] Account → Delete account (use a throwaway test account)
- [ ] Offline banner appears when airplane mode on
- [ ] No internal API URLs or debug text in UI
- [ ] [`DEVICE_CHECKLIST.md`](DEVICE_CHECKLIST.md) signed off for this versionCode

---

## Build workflow

### 1. Internal preview (APK)

```bash
cd apps/mobile
pnpm build:android:preview
```

Install the APK from the Expo build page on a physical Android device.

### 2. Production AAB (Play Store)

**Prefer local** (no EAS cloud queue — needs Docker/Colima + Android toolchain):

```bash
cd apps/mobile
colima start   # if Docker daemon is not running
pnpm build:android:prod:local
# → apps/mobile/dist/chessschool-release.aab
```

**Cloud** (free tier often waits hours in queue):

```bash
cd apps/mobile
pnpm build:android:prod
```

- Output: **Android App Bundle** (`.aab`)
- `versionCode` auto-increments via EAS (`autoIncrement: true`)
- First build: EAS generates the upload keystore — **save credentials in Expo dashboard**

### 3. Submit to Play Console

**One-time:** add a Google Play **service account JSON** in Expo credentials (`eas credentials` → Android → Google Service Account), with Play Console API access to the app. Until that exists, use manual upload.

**Internal testing track** (recommended first):

```bash
# After a cloud EAS build:
pnpm submit:android:internal

# After a local AAB (interactive — needs Play service account on Expo):
pnpm submit:android:internal:local
```

**Manual upload** (works without Expo Play credentials):

1. Open [Play Console](https://play.google.com/console) → ChessSchool (`com.chessschool.app`)
2. Fill listing from [`store-assets/play-store/LISTING.md`](store-assets/play-store/LISTING.md)
3. Release → Testing → Internal testing → Create release
4. Upload `apps/mobile/dist/chessschool-release.aab`
5. Roll out to internal testers

**Play submit stays a draft on the internal track.** The `play-store` profile sets `track: internal` and `releaseStatus: draft`, so `pnpm submit:android:store` cannot publish a completed production release. Promote that draft in Play Console after QA.

```bash
pnpm submit:android:store
```

`eas.json` has no `submit` `ios` block, so nothing here auto-releases to TestFlight or the App Store. The `production` submit profile is also `track: internal` and `releaseStatus: draft`, so `pnpm submit:android:internal` cannot roll out a completed release either.

---

## iOS builds and Stockfish

Android EAS builds do not compile the Stockfish pod (`modules/stockfish` is Apple-only). iOS builds do.

`modules/stockfish/ios/engine/` is gitignored. `package.json` → `eas-build-pre-install` runs `scripts/fetch-stockfish.sh` before dependencies and `pod install`. The script:

- Runs the download only when `EAS_BUILD_PLATFORM` is `ios` or unset (local). Any other EAS platform, including Android, exits 0 without downloading.
- Pins **Stockfish 18** (`sf_18`, the same major release as the web WASM engine) plus the two NNUE nets named in that tag's `evaluate.h`.
- Checks SHA-256 on the source tarball and both nets, and exits 1 if a download or checksum fails. `pod install` then never sees a half-written tree.
- Is safe to re-run: a matching stamp and matching net checksums skip the download.
- Writes Stockfish's own `Copying.txt` and `AUTHORS` next to the sources (`modules/stockfish/ios/engine/`). Those files stay gitignored with the rest of `engine/`.

Local iOS (the hook does not run outside EAS):

```bash
cd apps/mobile
bash scripts/fetch-stockfish.sh    # or: pnpm fetch-stockfish
npx expo prebuild -p ios
npx expo run:ios
```

Do not commit `engine/` or the `.nnue` files. Pins, checksums, and the embedded net payload (one copy via `incbin`, not copied again as pod resources) are in [`STOCKFISH.md`](STOCKFISH.md). GPL notes for the binary are there too; the in-app licence screen is a separate change.

There is no `eas.json` change. The hook is the `eas-build-pre-install` script in `apps/mobile/package.json`, which EAS runs for the mobile app.

### iOS download size

The NNUE nets alone are about 112 MB (112,439,224 bytes: the big net plus the small net), embedded once. The App Store download must stay under 200 MB.

TODO: record the IPA size from the first iOS EAS build.

---

## QA simulator (manual Maestro)

One manual EAS workflow run per promotion candidate. The workflow file is `apps/mobile/.eas/workflows/qa-sim.yml`. Its only trigger is `workflow_dispatch`.

The `qa-sim` profile in `eas.json` is an internal build with no update channel and no submit block. `distribution` is set on the profile and again on `ios` and `android`. EAS fills a platform object that omits `distribution` with `store`, and that value overrides the profile. iOS sets `ios.simulator` and `withoutCredentials` (a simulator `.app` does not use an Apple distribution certificate). Android builds an APK with the same Gradle workaround as `preview`. `EXPO_PUBLIC_API_URL` is set per platform and inlined into `src/api.ts` at bundle time:

| Platform         | API base                |
| ---------------- | ----------------------- |
| iOS Simulator    | `http://localhost:3108` |
| Android Emulator | `http://10.0.2.2:3108`  |

Trigger it from the app directory on the candidate ref. `platform` is `both` (the default), `ios`, or `android`. Leave `git_commit_sha` empty to build the commit this run checked out. A value must be the full 40-character SHA and must already be HEAD. The job does not fetch or check out a different commit.

```bash
cd apps/mobile
eas workflow:run .eas/workflows/qa-sim.yml \
  -F platform=both \
  -F git_commit_sha="$(git rev-parse HEAD)"
```

Dispatch the run on the candidate commit (the CLI checkout, or the workflow API `gitRef`) so the workflow file and the binary are that commit.

What the run guards:

- The first step exits if any `TURSO_*` variable is set, or if `DATABASE_URL` does not start with `file:`. Values are not printed. Jobs use the `development` environment and set `DATABASE_URL=file:local.db`.
- The profile sets `EXPO_PUBLIC_QA_SIM=1`. That flag drops the production host fallback and the apex-to-www rewrite from the bundle. A `qa-sim` build fails unless `EXPO_PUBLIC_API_URL` is exactly `http://localhost:3108` or `http://10.0.2.2:3108` and `EXPO_PUBLIC_QA_SIM` is exactly `1`. After the JS bundle is built, `eas-build-on-success` greps it and fails if `chess-school.in` appears.
- On the Maestro runner (the same machine that drives the simulator), `scripts/qa-sim-web.sh` runs `pnpm db:provision` in `apps/web` (`db:reset`, `db:push`, `db:load-seed` from `db/seed.sql.gz`), then `next build` and `next start -p 3108`.
- Maestro runs `parity/maestro/flows/qa/` (see that directory's README). Logs and screenshots upload as `qa-sim-ios-maestro` and `qa-sim-android-maestro`.

Android sets `withoutCredentials`, so the APK is debug-signed and does not use a remote keystore. The build log must confirm that no remote keystore was downloaded. This profile does not submit to Play or the App Store.

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

| Change                                     | OTA | New AAB |
| ------------------------------------------ | --- | ------- |
| UI copy, styles, lesson logic (JS)         | ✅  |         |
| New npm dependency with **no** native code | ✅  |         |
| New native module, permission, SDK bump    |     | ✅      |
| `app.json` version bump for store listing  |     | ✅      |
| Icon / splash / adaptive icon              |     | ✅      |

---

## Google Play Store listing (Phase 2)

Copy + Data safety answers: [`store-assets/play-store/LISTING.md`](store-assets/play-store/LISTING.md)  
Device smoke checklist: [`store-assets/play-store/SMOKE_QA.md`](store-assets/play-store/SMOKE_QA.md)

| Field              | Value                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| App name           | ChessSchool                                                              |
| Short description  | Graduate through chess classes, puzzles, and matches.                    |
| Privacy policy URL | `https://chess-school.in/privacy`                                        |
| Category           | Education                                                                |
| Content rating     | Complete IARC → likely Everyone                                          |
| Target audience    | 13+ (accounts + online play)                                             |
| Data safety        | Email, name, gameplay progress; encrypted in transit; deletion available |

**Assets (ready in `store-assets/play-store/`):**

- App icon 512×512 — `icon-512.png`
- Feature graphic 1024×500 — `feature-graphic-1024x500.png`
- Phone screenshots × 6 — `screenshots/01-academy.png` … `06-profile.png`

**Screenshot login (made up, test-only).** The Maestro screenshot job signs in as
a fictional student, Alex. Alex is not a real account and is not in the curriculum
seed. Seed the CI runner's local API database with `pnpm db:seed:test-user`
(see `apps/web/db/README.md`). The script refuses production and any non-local
database.

Set `STORE_SHOT_EMAIL` and `STORE_SHOT_PASSWORD` to choose the login. When either
is unset or blank, the script uses that variable's made-up default. It does not
print the values. After a successful seed it removes any existing
`apps/web/.store-shot.env` and writes a new file with mode `0600` (gitignored)
as `STORE_SHOT_EMAIL` and `STORE_SHOT_PASSWORD`.

| Variable              | Default when unset            |
| --------------------- | ----------------------------- |
| `STORE_SHOT_EMAIL`    | `alex@test.chessschool.local` |
| `STORE_SHOT_PASSWORD` | `AlexTestOnly1`               |

**Review notes:** Provide a test account email/password for Google reviewers.

---

## Version numbering

- **`app.json` → `version`** — user-visible semver (`0.2.0`). Bump for store releases.
- **`android.versionCode`** — integer; EAS auto-increments on production builds.
- **`runtimeVersion`** — `appVersion` policy: OTA updates only apply to builds with the same `expo.version`.

---

## Troubleshooting

| Issue                                                                      | Fix                                                                                                                                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No Next.js` / monorepo build fails on Vercel                              | Web only — mobile uses EAS, not Vercel                                                                                                                               |
| EAS build can't resolve `@chess-school/core`                               | Run build from `apps/mobile`; pnpm workspace is auto-detected                                                                                                        |
| EAS Gradle / KSP failure (`IncompatibleClassChangeError`, kotlin metadata) | Do **not** set `expo-build-properties.android.kotlinVersion` — let Expo SDK 54 pick the toolchain. Keep `gradleCommand` + `GRADLE_OPTS` with configure-on-demand off |
| Preview APK instant crash on open                                          | Pin Expo SDK-compatible natives (`expo-speech@~14` for SDK 54). Rebuild after `expo install` — stale wrong ABI builds crash at module load                           |
| OTA not applying                                                           | Run `eas update:configure`; production build must use `channel: production`                                                                                          |
| Updates disabled in dev                                                    | Expected — OTA only runs in release builds                                                                                                                           |
| Play rejection: missing deletion                                           | Account screen → Delete account                                                                                                                                      |
| Play rejection: privacy                                                    | Ensure `/privacy` is deployed on production                                                                                                                          |

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
eas workflow:run .eas/workflows/qa-sim.yml -F platform=both
eas build:list
eas credentials
```
