import { createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createOtaHandler, memoryStorage, parseMultipart, publishExport, sqlMetadata, type SqlClient } from "ota-server";
import { createApp } from "../src/app";
import { openDb } from "../src/db";

const HEADERS = { accept: "multipart/mixed", "expo-protocol-version": "1", "expo-platform": "ios", "expo-runtime-version": "0.7.0", "expo-channel-name": "production", "eas-client-id": "device-1" };

/** A tiny `expo export` output: one bundle and one image. */
function fakeExport() {
  const dist = mkdtempSync(join(tmpdir(), "ota-e2e-"));
  writeFileSync(join(dist, "bundle.hbc"), "console.log('hi')");
  writeFileSync(join(dist, "logo.png"), "png-bytes");
  writeFileSync(join(dist, "metadata.json"), JSON.stringify({ fileMetadata: { ios: { bundle: "bundle.hbc", assets: [{ path: "logo.png", ext: "png" }] } } }));
  return dist;
}

async function setup() {
  const db = await openDb(":memory:");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const metadata = sqlMetadata(db.$client as unknown as SqlClient);
  const storage = memoryStorage();
  const ota = createOtaHandler({ basePath: "/ota", metadata, storage, signingKey: privateKey.export({ type: "pkcs8", format: "pem" }) as string, adminToken: "admin-token" });
  const app = createApp({ db, google: null, secureCookies: false, corsOrigins: [], ota });
  const publish = (rolloutPercent = 100) => publishExport({ distDir: fakeExport(), platform: "ios", channel: "production", runtimeVersion: "0.7.0", message: "test", rolloutPercent, storage, metadata });
  const check = (headers: Record<string, string> = {}) => app.request("/ota/manifest", { headers: { ...HEADERS, ...headers } });
  return { app, publish, check, publicKey };
}

describe("over-the-air updates through the API mount", () => {
  it("publishes, serves a signed multipart manifest, serves the assets, and pauses on the admin route", async () => {
    const { app, publish, check, publicKey } = await setup();
    expect((await check()).status).toBe(204);

    const record = await publish();
    const res = await check({ "expo-expect-signature": 'sig, keyid="main", alg="rsa-v1_5-sha256"' });
    expect(res.status).toBe(200);
    expect(res.headers.get("expo-protocol-version")).toBe("1");
    expect(res.headers.get("expo-sfv-version")).toBe("0");
    expect(res.headers.get("expo-manifest-filters")).toBe('channel="production"');
    expect(res.headers.has("expo-server-defined-headers")).toBe(true);
    expect(res.headers.get("content-type")).toMatch(/^multipart\/mixed; boundary=/);
    const parts = parseMultipart(await res.text(), res.headers.get("content-type")!);
    const manifest = JSON.parse(parts.manifest!.body);
    expect(manifest).toMatchObject({ id: record.id, runtimeVersion: "0.7.0", launchAsset: { contentType: "application/javascript" } });
    expect(manifest.assets).toHaveLength(1);
    const sig = /sig="([^"]+)"/.exec(parts.manifest!.headers["expo-signature"]!)![1]!;
    expect(createVerify("RSA-SHA256").update(parts.manifest!.body).verify(publicKey, sig, "base64")).toBe(true);

    const asset = await app.request(new URL(manifest.launchAsset.url).pathname);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("console.log('hi')");

    // A device on another runtime or channel gets nothing.
    expect((await check({ "expo-runtime-version": "0.6.0" })).status).toBe(204);
    expect((await check({ "expo-channel-name": "preview" })).status).toBe(204);

    expect((await app.request("/ota/channels/production/pause", { method: "POST" })).status).toBe(401);
    const paused = await app.request("/ota/channels/production/pause", { method: "POST", headers: { authorization: "Bearer admin-token" } });
    expect(((await paused.json()) as { paused: { id: string }[] }).paused.map((r) => r.id)).toEqual([record.id]);
    expect((await check()).status).toBe(204);

    await app.request("/ota/channels/production/rollback", { method: "POST", headers: { authorization: "Bearer admin-token" } });
    const back = await check({ "expo-current-update-id": record.id, "expo-embedded-update-id": "embedded" });
    const directive = parseMultipart(await back.text(), back.headers.get("content-type")!).directive!;
    expect(JSON.parse(directive.body).type).toBe("rollBackToEmbedded");
  });

  it("answers 404 under /ota when the server is not configured", async () => {
    const app = createApp({ db: await openDb(":memory:"), google: null, secureCookies: false, corsOrigins: [] });
    expect((await app.request("/ota/manifest", { headers: HEADERS })).status).toBe(404);
  });
});
