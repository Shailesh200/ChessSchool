import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { SignatureV4 } from "@smithy/signature-v4";
import { describe, expect, it } from "vitest";
import { assetHash, fsStorage, memoryMetadata, OTA_SCHEMA_SQL, publishExport, runtimeVersionFrom, s3Storage, signS3Request, sqlMetadata, memoryStorage, type MetadataStore } from "../src";
import { update } from "./helpers";

async function sql(): Promise<MetadataStore> {
  const client = createClient({ url: ":memory:" });
  for (const s of OTA_SCHEMA_SQL) await client.execute(s);
  return sqlMetadata(client as never);
}

describe.each([
  ["memory", async () => memoryMetadata()],
  ["sql", sql],
])("%s metadata", (_, open) => {
  it("lists newest first, filters, and lets '*' rows match any runtime and platform", async () => {
    const m = await open();
    const a = update({ platform: "ios" });
    const b = update({ platform: "android" });
    const rb = update({ kind: "rollback", platform: "*", runtimeVersion: "*", body: null });
    await m.add(a);
    await m.add(b);
    await m.add(rb);
    expect((await m.list({ channel: "production", platform: "ios", runtimeVersion: "1.0.0" })).map((r) => r.id)).toEqual([rb.id, a.id]);
    expect((await m.list({ channel: "staging" })).length).toBe(0);
    expect(await m.get(a.id)).toEqual(a);
  });

  it("updates rollout and pause", async () => {
    const m = await open();
    const a = update();
    await m.add(a);
    await m.update(a.id, { rolloutPercent: 25 });
    await m.update(a.id, { paused: true });
    expect(await m.get(a.id)).toMatchObject({ rolloutPercent: 25, paused: true });
  });
});

/** The Hash interface @smithy/signature-v4 expects, over node:crypto. */
class NodeSha256 {
  private chunks: (Uint8Array | string)[] = [];
  constructor(private secret?: Uint8Array | string) {}
  update(d: Uint8Array | string) {
    this.chunks.push(d);
  }
  async digest() {
    const h = this.secret ? createHmac("sha256", this.secret) : createHash("sha256");
    for (const c of this.chunks) h.update(c);
    return new Uint8Array(h.digest());
  }
  reset() {
    this.chunks = [];
  }
}

describe("s3 storage", () => {
  const cfg = { endpoint: "https://acct.r2.cloudflarestorage.com", bucket: "media", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", region: "auto" };

  it("signs like the AWS SDK's SigV4 signer", async () => {
    const date = new Date("2026-11-16T10:20:30Z");
    const body = new TextEncoder().encode("hello");
    const ours = signS3Request(cfg, "PUT", "ota/assets/a b", body, date);
    const sdk = new SignatureV4({ service: "s3", region: "auto", credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }, sha256: NodeSha256 as never, uriEscapePath: false, applyChecksum: true });
    const signed = await sdk.sign(
      {
        method: "PUT",
        protocol: "https:",
        hostname: "acct.r2.cloudflarestorage.com",
        path: "/media/ota/assets/a%20b",
        headers: { host: "acct.r2.cloudflarestorage.com", "x-amz-content-sha256": createHash("sha256").update(body).digest("hex") },
        body,
        query: {},
      },
      { signingDate: date, unsignableHeaders: new Set() },
    );
    expect(ours.url).toBe("https://acct.r2.cloudflarestorage.com/media/ota/assets/a%20b");
    expect(ours.headers.authorization).toBe(signed.headers.authorization);
  });

  it("puts with the prefix and treats 404 as missing", async () => {
    const calls: { url: string; method: string }[] = [];
    const s = s3Storage({
      ...cfg,
      prefix: "ota",
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, method: init.method! });
        return new Response(init.method === "HEAD" ? null : "", { status: init.method === "HEAD" ? 404 : 200 });
      }) as never,
    });
    await s.put("assets/x", new Uint8Array([1]), "image/png");
    expect(await s.has("assets/x")).toBe(false);
    expect(calls).toEqual([
      { url: "https://acct.r2.cloudflarestorage.com/media/ota/assets/x", method: "PUT" },
      { url: "https://acct.r2.cloudflarestorage.com/media/ota/assets/x", method: "HEAD" },
    ]);
  });
});

describe("fs storage", () => {
  it("stores files with their type and refuses keys outside its folder", async () => {
    const s = fsStorage(mkdtempSync(join(tmpdir(), "ota-fs-")));
    await s.put("assets/k", new Uint8Array([7]), "font/ttf");
    expect(await s.has("assets/k")).toBe(true);
    expect(await s.get("assets/k")).toEqual({ body: new Uint8Array([7]), contentType: "font/ttf" });
    await expect(s.put("../evil", new Uint8Array(), "x")).rejects.toThrow();
  });
});

describe("publish", () => {
  it("uploads an expo export once per file and registers the update", async () => {
    const dist = mkdtempSync(join(tmpdir(), "ota-dist-"));
    mkdirSync(join(dist, "_expo/static/js/ios"), { recursive: true });
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "_expo/static/js/ios/entry-abc.hbc"), "bundle");
    writeFileSync(join(dist, "assets/5d41402abc4b2a76b9719d911017c592"), "png-bytes");
    writeFileSync(join(dist, "metadata.json"), JSON.stringify({ version: 0, bundler: "metro", fileMetadata: { ios: { bundle: "_expo/static/js/ios/entry-abc.hbc", assets: [{ path: "assets/5d41402abc4b2a76b9719d911017c592", ext: "png" }] } } }));
    const storage = memoryStorage();
    const metadata = memoryMetadata();
    const r = await publishExport({ distDir: dist, platform: "ios", channel: "production", runtimeVersion: "1.0.0", message: "m", rolloutPercent: 10, expoConfig: { name: "Demo" }, storage, metadata });
    expect(r).toMatchObject({ kind: "update", platform: "ios", rolloutPercent: 10, message: "m" });
    expect(r.body!.launchAsset).toMatchObject({ hash: assetHash(new TextEncoder().encode("bundle")), contentType: "application/javascript" });
    expect(r.body!.launchAsset.fileExtension).toBeUndefined();
    expect(r.body!.assets[0]).toMatchObject({ contentType: "image/png", fileExtension: ".png", key: createHash("md5").update("png-bytes").digest("hex") });
    expect(r.body!.extra).toEqual({ expoClient: { name: "Demo" } });
    expect(await storage.has(r.body!.assets[0]!.storageKey)).toBe(true);
    await expect(publishExport({ distDir: dist, platform: "android", channel: "production", runtimeVersion: "1", storage, metadata })).rejects.toThrow(/no android/);
  });

  it("reads the runtime version from the app config", () => {
    expect(runtimeVersionFrom({ version: "0.7.0", runtimeVersion: { policy: "appVersion" } }, "ios")).toBe("0.7.0");
    expect(runtimeVersionFrom({ runtimeVersion: "abc" }, "android")).toBe("abc");
    expect(runtimeVersionFrom({ runtimeVersion: { policy: "fingerprint" } }, "ios")).toBeNull();
  });
});
