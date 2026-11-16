import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AssetStorage } from "./types";

/** Keeps files in memory. For tests. */
export function memoryStorage(): AssetStorage {
  const files = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    async put(key, body, contentType) {
      files.set(key, { body, contentType });
    },
    async has(key) {
      return files.has(key);
    },
    async get(key) {
      return files.get(key) ?? null;
    },
  };
}

/** Files in a local folder (content type in a `.type` file next to each). For local runs and self-hosting on one box. */
export function fsStorage(dir: string): AssetStorage {
  const root = resolve(dir);
  const path = (key: string) => {
    const p = resolve(root, key);
    if (!p.startsWith(root + "/")) throw new Error(`bad asset key: ${key}`);
    return p;
  };
  return {
    async put(key, body, contentType) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), body);
      await writeFile(`${path(key)}.type`, contentType);
    },
    async has(key) {
      return stat(path(key)).then(
        () => true,
        () => false,
      );
    },
    async get(key) {
      try {
        return { body: new Uint8Array(await readFile(path(key))), contentType: await readFile(`${path(key)}.type`, "utf8") };
      } catch {
        return null;
      }
    },
  };
}

export type S3Config = {
  /** e.g. https://<account>.r2.cloudflarestorage.com for Cloudflare R2. */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** "auto" for R2. */
  region?: string;
  /** Prefix for every key, e.g. "ota". */
  prefix?: string;
  fetch?: typeof fetch;
  now?: () => Date;
};

const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();
const encodeSegment = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Signs one S3 request with AWS Signature Version 4 (path-style URL). Exported for tests.
 * Signs host, x-amz-content-sha256 and x-amz-date.
 */
export function signS3Request(cfg: S3Config, method: string, key: string, body: Uint8Array | undefined, date: Date) {
  const region = cfg.region ?? "auto";
  const url = new URL(cfg.endpoint);
  const path = `/${encodeSegment(cfg.bucket)}/${key.split("/").map(encodeSegment).join("/")}`;
  const amzDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body ?? "");
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const signed = Object.keys(headers).sort();
  const canonical = [method, path, "", signed.map((h) => `${h}:${headers[h]}\n`).join(""), signed.join(";"), payloadHash].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`;
  delete headers.host;
  return { url: `${url.origin}${path}`, headers };
}

/** S3-compatible storage (Cloudflare R2, AWS S3, MinIO) over plain fetch, no SDK. */
export function s3Storage(cfg: S3Config): AssetStorage {
  const f = cfg.fetch ?? fetch;
  const full = (key: string) => (cfg.prefix ? `${cfg.prefix.replace(/\/$/, "")}/${key}` : key);
  const send = (method: string, key: string, body?: Uint8Array, extra: Record<string, string> = {}) => {
    const { url, headers } = signS3Request(cfg, method, full(key), body, (cfg.now ?? (() => new Date()))());
    return f(url, { method, headers: { ...headers, ...extra }, body: body as BodyInit | undefined });
  };
  return {
    async put(key, body, contentType) {
      const res = await send("PUT", key, body, { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" });
      if (!res.ok) throw new Error(`S3 PUT ${key} failed: ${res.status} ${await res.text()}`);
    },
    async has(key) {
      const res = await send("HEAD", key);
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(`S3 HEAD ${key} failed: ${res.status}`);
      return true;
    },
    async get(key) {
      const res = await send("GET", key);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 GET ${key} failed: ${res.status}`);
      return { body: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
    },
  };
}
