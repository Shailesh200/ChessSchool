import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pauseChannel, rollbackChannel, setPaused, setRollout } from "./admin";
import { guardDecision, pauseRollout, sentryReleaseHealth } from "./guard";
import { OTA_SCHEMA_SQL, sqlMetadata } from "./metadata";
import { publishExport, runtimeVersionFrom } from "./publish";
import { fsStorage, s3Storage } from "./storage";
import { PLATFORMS, type AssetStorage, type MetadataStore, type Platform } from "./types";

const USAGE = `ota <command>

  publish  --platform ios|android|all [--channel production] [--message "..."] [--rollout 100]
           [--project .] [--runtime-version <v>] [--dist <dir>  (skip \`expo export\`)]
  rollout  <update-id> <percent>
  pause    <update-id> | --channel <channel>
  resume   <update-id>
  rollback <channel> [--runtime-version <v>] [--platform ios|android]
  list     [--channel <channel>] [--platform ios|android]
  guard    --server <url> --channel <channel> --sentry-org <org> --sentry-project <project> [--dry-run]

Metadata: OTA_DATABASE_URL (libsql URL, e.g. file:./ota.db) and OTA_DATABASE_AUTH_TOKEN.
Assets:   OTA_S3_ENDPOINT, OTA_S3_BUCKET, OTA_S3_ACCESS_KEY_ID, OTA_S3_SECRET_ACCESS_KEY [OTA_S3_PREFIX, OTA_S3_REGION],
          or OTA_STORAGE_DIR (a local folder, default ./ota-assets).
Guard:    SENTRY_READ_TOKEN and OTA_ADMIN_TOKEN.`;

async function openMetadata(env: NodeJS.ProcessEnv): Promise<MetadataStore> {
  const url = env.OTA_DATABASE_URL;
  if (!url) throw new Error("OTA_DATABASE_URL is not set");
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url, authToken: env.OTA_DATABASE_AUTH_TOKEN });
  for (const sql of OTA_SCHEMA_SQL) await client.execute(sql);
  return sqlMetadata(client as unknown as Parameters<typeof sqlMetadata>[0]);
}

function openStorage(env: NodeJS.ProcessEnv): AssetStorage {
  const { OTA_S3_ENDPOINT: endpoint, OTA_S3_BUCKET: bucket, OTA_S3_ACCESS_KEY_ID: accessKeyId, OTA_S3_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (endpoint && bucket && accessKeyId && secretAccessKey) return s3Storage({ endpoint, bucket, accessKeyId, secretAccessKey, prefix: env.OTA_S3_PREFIX, region: env.OTA_S3_REGION });
  return fsStorage(env.OTA_STORAGE_DIR ?? "ota-assets");
}

const expo = (project: string, args: string[]) => execFileSync("npx", ["expo", ...args], { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024 });

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env, log: (s: string) => void = console.log): Promise<number> {
  const { values: o, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      platform: { type: "string" },
      channel: { type: "string" },
      message: { type: "string" },
      rollout: { type: "string" },
      project: { type: "string" },
      "runtime-version": { type: "string" },
      dist: { type: "string" },
      server: { type: "string" },
      "sentry-org": { type: "string" },
      "sentry-project": { type: "string" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  const [cmd, a, b] = positionals;
  try {
    switch (cmd) {
      case "publish": {
        const platforms: Platform[] = o.platform === "all" ? PLATFORMS : PLATFORMS.filter((p) => p === o.platform);
        if (!platforms.length) throw new Error("--platform must be ios, android or all");
        const project = resolve(o.project ?? ".");
        const dist = o.dist ? resolve(o.dist) : mkdtempSync(join(tmpdir(), "ota-export-"));
        if (!o.dist) expo(project, ["export", "--output-dir", dist, ...platforms.flatMap((p) => ["--platform", p])]);
        const config = JSON.parse(expo(project, ["config", "--type", "public", "--json"])) as Record<string, unknown>;
        const [metadata, storage] = [await openMetadata(env), openStorage(env)];
        for (const platform of platforms) {
          const runtimeVersion = o["runtime-version"] ?? runtimeVersionFrom(config, platform);
          if (!runtimeVersion) throw new Error("could not work out the runtime version; pass --runtime-version");
          const r = await publishExport({ distDir: dist, platform, channel: o.channel ?? "production", runtimeVersion, message: o.message, rolloutPercent: o.rollout ? Number(o.rollout) : 100, expoConfig: config, storage, metadata });
          log(`published ${r.id} ${platform} runtime ${r.runtimeVersion} channel ${r.channel} at ${r.rolloutPercent}% (${r.body!.assets.length + 1} files)`);
        }
        return 0;
      }
      case "rollout": {
        const r = await setRollout(await openMetadata(env), String(a), Number(b));
        log(`${r.id} now at ${r.rolloutPercent}%`);
        return 0;
      }
      case "pause":
      case "resume": {
        const metadata = await openMetadata(env);
        if (cmd === "pause" && o.channel) {
          const paused = await pauseChannel(metadata, o.channel);
          log(paused.length ? paused.map((r) => `paused ${r.id} ${r.platform} ${r.runtimeVersion}`).join("\n") : "nothing live to pause");
          return 0;
        }
        const r = await setPaused(metadata, String(a), cmd === "pause");
        log(`${r.id} ${r.paused ? "paused" : "resumed"}`);
        return 0;
      }
      case "rollback": {
        if (!a) throw new Error("rollback needs a channel");
        const platform = o.platform as Platform | undefined;
        const r = await rollbackChannel(await openMetadata(env), a, { runtimeVersion: o["runtime-version"], platform });
        log(`${a}: devices roll back to the embedded update (${r.id})`);
        return 0;
      }
      case "list": {
        const rows = await (await openMetadata(env)).list({ channel: o.channel, platform: o.platform as Platform | undefined, limit: 50 });
        for (const r of rows) log([r.createdAt, r.id, r.kind, r.channel, r.platform, r.runtimeVersion, `${r.rolloutPercent}%`, r.paused ? "paused" : "live", r.message].join("  "));
        if (!rows.length) log("no updates");
        return 0;
      }
      case "guard": {
        const token = env.SENTRY_READ_TOKEN;
        if (!token || !o["sentry-org"] || !o["sentry-project"] || !o.server || !o.channel) throw new Error("guard needs SENTRY_READ_TOKEN, --sentry-org, --sentry-project, --server and --channel");
        const health = await sentryReleaseHealth({ token, org: o["sentry-org"], project: o["sentry-project"] });
        if (!health) return log("no releases in Sentry yet"), 0;
        const d = guardDecision(health);
        log(d.reason);
        if (!d.pause) return 0;
        if (o["dry-run"]) return log("dry run: would pause the rollout"), 0;
        if (!env.OTA_ADMIN_TOKEN) throw new Error("OTA_ADMIN_TOKEN is not set");
        const { paused } = await pauseRollout({ server: o.server, channel: o.channel, adminToken: env.OTA_ADMIN_TOKEN });
        log(paused.length ? `paused ${paused.map((r) => `${r.id} (${r.platform})`).join(", ")}` : "nothing live to pause");
        return 2;
      }
      default:
        log(USAGE);
        return cmd && !o.help ? 1 : 0;
    }
  } catch (err) {
    log(`ota: ${(err as Error).message}`);
    return 1;
  }
}
