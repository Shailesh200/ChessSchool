# ota-server

A small self-hosted server for [Expo Updates](https://docs.expo.dev/technical-specs/expo-updates-1/) (protocol v1).
It answers the update checks that `expo-updates` makes, so you can ship over-the-air updates to a React Native
app from your own API and your own bucket.

- Protocol v1 manifests as `multipart/mixed`, with the `expo-protocol-version`, `expo-sfv-version`,
  `expo-manifest-filters` and `expo-server-defined-headers` headers
- iOS and Android, matched by runtime version and channel
- Staged rollouts by a stable hash of the device's `eas-client-id`
- Pause an update, or roll a whole channel back to the build's embedded update (`rollBackToEmbedded` directive)
- Optional code signing (RSA-SHA256 `expo-signature`)
- A fetch-style handler (`Request` in, `Response` out): works in Hono, Next.js route handlers, Bun, Deno, Node 20+
- Storage adapters: S3-compatible (Cloudflare R2, AWS S3, MinIO; no SDK needed), a local folder, in-memory
- Metadata adapters: SQLite / libsql (Turso), in-memory
- A CLI: `ota publish | rollout | pause | resume | rollback | list | guard`

The package ships TypeScript source and has no build step.

## Serve

```ts
import { createClient } from "@libsql/client";
import { createOtaHandler, OTA_SCHEMA_SQL, s3Storage, sqlMetadata } from "ota-server";

const db = createClient({ url: process.env.OTA_DATABASE_URL!, authToken: process.env.OTA_DATABASE_AUTH_TOKEN });
for (const sql of OTA_SCHEMA_SQL) await db.execute(sql); // CREATE TABLE IF NOT EXISTS, safe to repeat

const ota = createOtaHandler({
  basePath: "/ota",
  metadata: sqlMetadata(db),
  storage: s3Storage({ endpoint, bucket, accessKeyId, secretAccessKey, prefix: "ota" }),
  assetBaseUrl: "https://cdn.example.com/ota", // optional: let devices download from a public bucket
  signingKey: process.env.OTA_SIGNING_KEY,     // optional: PEM private key
  adminToken: process.env.OTA_ADMIN_TOKEN,     // optional: enables the admin routes
});

// Hono
app.all("/ota/*", (c) => ota(c.req.raw));
// Next.js: export const GET = ota; export const POST = ota;   in app/ota/[...path]/route.ts
```

Point the app at it in `app.json`:

```json
{ "expo": { "runtimeVersion": { "policy": "appVersion" }, "updates": { "url": "https://api.example.com/ota/manifest" } } }
```

The channel comes from the `expo-channel-name` request header. EAS Build sets it from the build profile's
`channel`; otherwise set `updates.requestHeaders` yourself.

### Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /manifest` | the app | The update check. 200 multipart with a `manifest` or `directive` part, or 204 when there is nothing for this runtime and channel |
| `GET /assets/<key>` | the app | Asset bytes, when `storage` is set and `assetBaseUrl` is not |
| `GET /updates?channel=&platform=` | admin | Newest first |
| `GET /current?channel=` | admin | What each platform gets now |
| `POST /updates/<id>/rollout` `{ "percent": 25 }` | admin | Change the rollout share |
| `POST /updates/<id>/pause`, `/resume` | admin | Skip an update, or bring it back |
| `POST /channels/<channel>/pause` | admin | Pause the newest live update for each runtime and platform |
| `POST /channels/<channel>/rollback` | admin | Send devices back to the embedded update |

Admin routes need `Authorization: Bearer <adminToken>`. Without an `adminToken` they answer 404.

### How an update is chosen

For a device's channel, runtime version and platform, the server walks the records newest first and picks the
first one that is not paused and whose rollout includes the device. A device's bucket is
`sha256(updateId + ":" + clientId) % 100`, so it stays in or out on every check, and raising the percentage only
adds devices. Devices outside a rollout get the next older update. Devices that send no client id only get
fully rolled-out updates. A rollback record makes the server answer with the `rollBackToEmbedded` directive
until a newer update is published.

## Publish

```sh
export OTA_DATABASE_URL=file:./ota.db            # or a libsql:// URL with OTA_DATABASE_AUTH_TOKEN
export OTA_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com OTA_S3_BUCKET=my-bucket \
       OTA_S3_ACCESS_KEY_ID=… OTA_S3_SECRET_ACCESS_KEY=… OTA_S3_PREFIX=ota
# or, for a local try: export OTA_STORAGE_DIR=./ota-assets

npx ota publish --platform all --channel production --message "Fix the board flip" --rollout 10
npx ota list --channel production
npx ota rollout <update-id> 50
npx ota pause <update-id>            # or: npx ota pause --channel production
npx ota rollback production          # everyone back to the build's embedded update
```

`publish` runs `npx expo export` in the project (`--project`, default `.`), uploads the bundle and assets
(content-addressed, so unchanged files are skipped) and registers the update. The runtime version comes from
the app config (a plain string or the `appVersion` policy); pass `--runtime-version` for other policies.
`--dist <dir>` publishes an export you already made.

## Code signing

Create a key and certificate as the
[Expo docs](https://docs.expo.dev/eas-update/code-signing/) describe, set `updates.codeSigningCertificate` and
`updates.codeSigningMetadata` (`keyid`, `alg: "rsa-v1_5-sha256"`) in the app config, and pass the private key
as `signingKey` (and the same `keyid` as `signingKeyId`, default `main`). The server signs when the app sends
`expo-expect-signature`. Keep the private key out of the repository.

## Rollout guard

`ota guard` reads the newest release's crash-free session rate from the Sentry API and pauses the channel
when it falls below 99.5% with at least 50 sessions. Run it on a schedule:

```sh
SENTRY_READ_TOKEN=… OTA_ADMIN_TOKEN=… npx ota guard --server https://api.example.com/ota \
  --channel production --sentry-org my-org --sentry-project my-app [--dry-run]
```

It exits 2 after pausing, so a scheduled job shows up as failed. `guardDecision` is exported if you read
health from somewhere else.

## Write your own adapter

`MetadataStore` (`add`, `get`, `list`, `update`) and `AssetStorage` (`put`, `has`, `get`) in `src/types.ts`
are the two interfaces. `memoryMetadata()` and `memoryStorage()` are the reference implementations.

## Tests

```sh
pnpm test        # vitest
pnpm typecheck
```

## License

MIT
