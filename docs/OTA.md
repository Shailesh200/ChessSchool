# Over-the-air updates and staged rollouts

ChessSchool ships JavaScript updates from its own server: `packages/ota-server` (generic, MIT), mounted in
the API at `https://api.chess-school.in/ota/*` (`apps/chessschool-api/src/ota.ts`). The app checks
`/ota/manifest` on launch (`updates.url` in `apps/chessschool/app.json`). Update records live in the API
database (table `ota_updates`); bundles and assets live in the R2 bucket under `ota/`.

An update only reaches builds with the same runtime version (the app version, e.g. `0.7.0`) and channel
(`production` for store builds). Builds made before 0.7.0 still check the old Expo-hosted URL.

## One-time setup (lead)

1. `bash scripts/ota-signing-key.sh` creates the signing key and the admin token in
   `~/ChessSchool-handoff/secrets.env`, writes the public certificate to
   `apps/chessschool/certs/ota-signing.crt` and adds it to `app.json`. Commit the certificate and `app.json`
   before the 0.7.0 store build. Skipping this step leaves updates unsigned (they still work).
2. On the API host set `OTA_SIGNING_KEY`, `OTA_ADMIN_TOKEN`, and the `R2_*` values the voice clips already use
   (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`).
3. GitHub secrets for the rollout guard: `SENTRY_READ_TOKEN`, `OTA_ADMIN_TOKEN`.

## Publish, widen, pause, roll back

Load the values from the secrets file into your shell first (never paste them):

```sh
val() { grep -E "^$1=" ~/ChessSchool-handoff/secrets.env | cut -d= -f2-; }
export OTA_DATABASE_URL=$(val DATABASE_URL) OTA_DATABASE_AUTH_TOKEN=$(val DATABASE_AUTH_TOKEN)
export OTA_S3_ENDPOINT=https://$(val R2_ACCOUNT_ID).r2.cloudflarestorage.com OTA_S3_BUCKET=$(val R2_BUCKET)
export OTA_S3_ACCESS_KEY_ID=$(val R2_ACCESS_KEY_ID) OTA_S3_SECRET_ACCESS_KEY=$(val R2_SECRET_ACCESS_KEY) OTA_S3_PREFIX=ota
ota() { node packages/ota-server/bin/ota.mjs "$@"; }

ota publish --project apps/chessschool --platform all --channel production --message "What changed" --rollout 10
ota list --channel production
ota rollout <update-id> 50        # then 100
ota pause --channel production    # devices fall back to the previous update
ota resume <update-id>
ota rollback production           # everyone back to the JavaScript inside the store build
```

Start every update at 10%, wait a day for the rollout guard, then widen. A device's place in a rollout is a
stable hash of its install id, so the same devices stay in as the share grows.

Try it locally first: `OTA_DATABASE_URL=file:./ota.db OTA_STORAGE_DIR=./ota-assets` with the same commands,
then run the API with `DATABASE_URL=file:./ota.db OTA_STORAGE_DIR=./ota-assets` and fetch
`/ota/manifest` with the `expo-platform`, `expo-runtime-version` and `expo-protocol-version: 1` headers.

## Rollout guard

`.github/workflows/ota-rollout-guard.yml` runs daily. It reads the crash-free session rate of the newest app
release and pauses the `production` channel when the rate is under 99.5% with at least 50 sessions. The run
fails when it pauses. Fix the problem, publish a new update (or `ota resume <id>`).

## Store staged rollouts

OTA covers JavaScript only. Store builds roll out in stages too.

### Google Play

A production release takes a rollout fraction. In Play Console: Production, the release, "Manage rollout".
From the command line, `eas submit` reads it from `apps/chessschool/eas.json`:

```json
"submit": { "production": { "android": { "track": "production", "releaseStatus": "inProgress", "rollout": 0.1 } } }
```

`rollout` is a fraction from 0 to 1 and only applies with `releaseStatus: "inProgress"`. Suggested steps:
0.1 for a day, 0.5 for a day, then complete the rollout in Play Console ("Release to 100%"). To stop a bad
release, "Halt rollout" in Play Console. The committed profile stays on the `internal` track; change the track
only for the production submit.

### App Store

Phased release spreads an update over 7 days (1%, 2%, 5%, 10%, 20%, 50%, 100% of users with automatic
updates on). Turn it on in App Store Connect on the version page ("Phased Release for Automatic Updates"),
or through the App Store Connect API after the version is created and before it is released:

```
POST https://api.appstoreconnect.apple.com/v1/appStoreVersionPhasedReleases
{ "data": { "type": "appStoreVersionPhasedReleases",
            "attributes": { "phasedReleaseState": "INACTIVE" },
            "relationships": { "appStoreVersion": { "data": { "type": "appStoreVersions", "id": "<version id>" } } } } }
```

Find `<version id>` with `GET /v1/apps/6828715695/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION`.
The request is signed with the same API key the TestFlight workflow uses (`ASC_API_KEY_ID`,
`ASC_API_ISSUER_ID`, the .p8 key). The phased release starts when the version is released. To pause it (up to
30 days), `PATCH /v1/appStoreVersionPhasedReleases/<id>` with `"phasedReleaseState": "PAUSED"`; `"ACTIVE"`
resumes and `"COMPLETE"` releases to everyone. Phased release does not hold back people who update by hand
in the App Store.

## Device tests

`.github/workflows/device-tests.yml` builds the app for a simulator and an emulator and runs the Maestro
flows in `apps/chessschool/.maestro`. The TestFlight and Play workflows run it first and upload only when it
passes. Run locally with a simulator build: `maestro test apps/chessschool/.maestro`.
