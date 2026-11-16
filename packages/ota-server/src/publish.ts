import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assetHash, md5Hex } from "./protocol";
import type { AssetStorage, MetadataStore, OtaRecord, Platform, StoredAsset } from "./types";

const TYPES: Record<string, string> = {
  js: "application/javascript",
  hbc: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  lottie: "application/json",
};
export const contentTypeFor = (ext: string) => TYPES[ext.toLowerCase()] ?? "application/octet-stream";

/** The part of `expo export`'s dist/metadata.json we read. */
type ExportMetadata = { fileMetadata: Partial<Record<Platform, { bundle: string; assets: { path: string; ext: string }[] }>> };

export type PublishInput = {
  /** The output folder of `npx expo export`. */
  distDir: string;
  platform: Platform;
  channel: string;
  runtimeVersion: string;
  message?: string;
  rolloutPercent?: number;
  /** Public app config (`npx expo config --type public --json`), served as `extra.expoClient`. */
  expoConfig?: Record<string, unknown>;
  storage: AssetStorage;
  metadata: MetadataStore;
  now?: Date;
};

/** Uploads one platform's exported bundle and assets (skipping ones already stored) and registers the update. */
export async function publishExport(input: PublishInput): Promise<OtaRecord> {
  const meta = JSON.parse(await readFile(join(input.distDir, "metadata.json"), "utf8")) as ExportMetadata;
  const files = meta.fileMetadata?.[input.platform];
  if (!files) throw new Error(`${input.distDir}/metadata.json has no ${input.platform} export`);

  const store = async (path: string, ext: string, contentType: string): Promise<StoredAsset> => {
    const data = new Uint8Array(await readFile(join(input.distDir, path)));
    const hash = assetHash(data);
    const storageKey = `assets/${Buffer.from(hash, "base64url").toString("hex")}`;
    if (!(await input.storage.has(storageKey))) await input.storage.put(storageKey, data, contentType);
    return { hash, key: md5Hex(data), contentType, fileExtension: `.${ext}`, storageKey };
  };

  const launchAsset = await store(files.bundle, "bundle", "application/javascript");
  delete launchAsset.fileExtension;
  const assets: StoredAsset[] = [];
  for (const a of files.assets) assets.push(await store(a.path, a.ext, contentTypeFor(a.ext)));

  const record: OtaRecord = {
    id: randomUUID(),
    kind: "update",
    channel: input.channel,
    runtimeVersion: input.runtimeVersion,
    platform: input.platform,
    createdAt: (input.now ?? new Date()).toISOString(),
    message: input.message ?? "",
    rolloutPercent: Math.max(0, Math.min(100, Math.round(input.rolloutPercent ?? 100))),
    paused: false,
    body: { launchAsset, assets, extra: input.expoConfig ? { expoClient: input.expoConfig } : {} },
  };
  await input.metadata.add(record);
  return record;
}

/** runtimeVersion from a public app config: a plain string, or the appVersion policy. Other policies need --runtime-version. */
export function runtimeVersionFrom(config: Record<string, unknown>, platform: Platform): string | null {
  const own = (config[platform] as { runtimeVersion?: unknown } | undefined)?.runtimeVersion ?? config.runtimeVersion;
  if (typeof own === "string") return own;
  if (own && typeof own === "object" && (own as { policy?: string }).policy === "appVersion" && typeof config.version === "string") return config.version;
  return null;
}
