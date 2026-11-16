import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOtaHandler, memoryMetadata, memoryStorage, parseMultipart, rollbackChannel, rolloutBucket, type MetadataStore } from "../src";
import { expoHeaders, update } from "./helpers";

const BASE = "https://api.example/ota";
const ADMIN = "admin-secret";

function setup(extra: Partial<Parameters<typeof createOtaHandler>[0]> = {}) {
  const metadata = memoryMetadata();
  const storage = memoryStorage();
  const handle = createOtaHandler({ metadata, storage, basePath: "/ota", adminToken: ADMIN, ...extra });
  const check = (headers: Record<string, string> = {}) => handle(new Request(`${BASE}/manifest`, { headers: expoHeaders(headers) }));
  const admin = (method: string, path: string, body?: unknown, token = ADMIN) =>
    handle(new Request(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }));
  return { metadata, storage, handle, check, admin };
}

async function parts(res: Response) {
  return parseMultipart(await res.text(), res.headers.get("content-type")!);
}

describe("manifest endpoint", () => {
  it("serves the newest update as multipart/mixed with the protocol headers", async () => {
    const { metadata, check } = setup();
    await metadata.add(update({ message: "old" }));
    const latest = update({ message: "new" });
    await metadata.add(latest);
    const res = await check();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^multipart\/mixed; boundary=/);
    expect(res.headers.get("expo-protocol-version")).toBe("1");
    expect(res.headers.get("expo-sfv-version")).toBe("0");
    expect(res.headers.get("expo-manifest-filters")).toBe('channel="production"');
    expect(res.headers.has("expo-server-defined-headers")).toBe(true);
    expect(res.headers.get("cache-control")).toBe("private, max-age=0");
    const p = await parts(res);
    const manifest = JSON.parse(p.manifest!.body);
    expect(manifest.id).toBe(latest.id);
    expect(manifest.launchAsset.url).toBe(`${BASE}/assets/assets/launch`);
    expect(JSON.parse(p.extensions!.body)).toEqual({ assetRequestHeaders: {} });
  });

  it("answers both platforms and keeps them apart", async () => {
    const { metadata, check } = setup();
    const ios = update({ platform: "ios" });
    const android = update({ platform: "android" });
    await metadata.add(ios);
    await metadata.add(android);
    expect(JSON.parse((await parts(await check({ "expo-platform": "ios" }))).manifest!.body).id).toBe(ios.id);
    expect(JSON.parse((await parts(await check({ "expo-platform": "android" }))).manifest!.body).id).toBe(android.id);
    expect((await check({ "expo-platform": "web" })).status).toBe(400);
  });

  it("answers 204 for a runtime or channel with no update (404 on protocol 0)", async () => {
    const { metadata, check } = setup();
    await metadata.add(update());
    expect((await check({ "expo-runtime-version": "2.0.0" })).status).toBe(204);
    expect((await check({ "expo-channel-name": "staging" })).status).toBe(204);
    const res = await check({ "expo-runtime-version": "2.0.0", "expo-protocol-version": "0" });
    expect(res.status).toBe(404);
    expect(res.headers.get("expo-protocol-version")).toBe("1");
  });

  it("says noUpdateAvailable when the device already runs the newest update", async () => {
    const { metadata, check } = setup();
    const r = update();
    await metadata.add(r);
    const p = await parts(await check({ "expo-current-update-id": r.id }));
    expect(p.manifest).toBeUndefined();
    expect(JSON.parse(p.directive!.body)).toEqual({ type: "noUpdateAvailable" });
  });

  it("sends rollBackToEmbedded after a rollback, and nothing once the device is on the embedded update", async () => {
    const { metadata, check } = setup();
    await metadata.add(update());
    const rb = await rollbackChannel(metadata, "production", { now: new Date("2026-11-20T00:00:00Z") });
    const p = await parts(await check({ "expo-current-update-id": "22222222-2222-4222-8222-222222222222" }));
    expect(JSON.parse(p.directive!.body)).toEqual({ type: "rollBackToEmbedded", parameters: { commitTime: rb.createdAt } });
    expect(JSON.parse((await parts(await check())).directive!.body)).toEqual({ type: "noUpdateAvailable" });
  });

  it("a newer update after a rollback wins again", async () => {
    const { metadata, check } = setup();
    await rollbackChannel(metadata, "production", { now: new Date("2026-10-01T00:00:00Z") });
    const r = update();
    await metadata.add(r);
    expect(JSON.parse((await parts(await check())).manifest!.body).id).toBe(r.id);
  });

  it("gives devices outside a staged rollout the previous update", async () => {
    const { metadata, check } = setup();
    const prev = update();
    const staged = update({ rolloutPercent: 30 });
    await metadata.add(prev);
    await metadata.add(staged);
    const inside = Array.from({ length: 200 }, (_, i) => `d${i}`).find((id) => rolloutBucket(staged.id, id) < 30)!;
    const outside = Array.from({ length: 200 }, (_, i) => `d${i}`).find((id) => rolloutBucket(staged.id, id) >= 30)!;
    expect(JSON.parse((await parts(await check({ "eas-client-id": inside }))).manifest!.body).id).toBe(staged.id);
    expect(JSON.parse((await parts(await check({ "eas-client-id": outside }))).manifest!.body).id).toBe(prev.id);
    // Older clients send the header under its old name.
    const old = expoHeaders({ "expo-eas-client-id": inside });
    delete old["eas-client-id"];
    const { handle } = { handle: createOtaHandler({ metadata, basePath: "/ota" }) };
    const res = await handle(new Request(`${BASE}/manifest`, { headers: old }));
    expect(JSON.parse((await parts(res)).manifest!.body).id).toBe(staged.id);
  });

  it("signs manifest and directive when a key is set and the client asks", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const { metadata, check } = setup({ signingKey: privateKey });
    const r = update();
    await metadata.add(r);
    const p = await parts(await check({ "expo-expect-signature": 'sig, keyid="main", alg="rsa-v1_5-sha256"' }));
    const sig = /sig="([^"]+)"/.exec(p.manifest!.headers["expo-signature"]!)![1]!;
    expect(createVerify("RSA-SHA256").update(p.manifest!.body).verify(publicKey, sig, "base64")).toBe(true);
    const d = await parts(await check({ "expo-expect-signature": "sig", "expo-current-update-id": r.id }));
    expect(d.directive!.headers["expo-signature"]).toMatch(/^sig="/);
    // Unsigned when the client does not ask.
    expect((await parts(await check())).manifest!.headers["expo-signature"]).toBeUndefined();
  });

  it("refuses a signature request without a key, and an unknown protocol", async () => {
    const { check } = setup();
    expect((await check({ "expo-expect-signature": "sig" })).status).toBe(400);
    expect((await check({ "expo-protocol-version": "2" })).status).toBe(406);
  });

  it("serves stored assets", async () => {
    const { storage, handle } = setup();
    await storage.put("assets/abc", new Uint8Array([1, 2, 3]), "image/png");
    const res = await handle(new Request(`${BASE}/assets/assets/abc`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await handle(new Request(`${BASE}/assets/nope`))).status).toBe(404);
  });

  it("uses assetBaseUrl for public buckets", async () => {
    const { metadata, check } = setup({ assetBaseUrl: "https://cdn.example/ota/" });
    await metadata.add(update());
    expect(JSON.parse((await parts(await check())).manifest!.body).launchAsset.url).toBe("https://cdn.example/ota/assets/launch");
  });
});

describe("admin routes", () => {
  async function seeded(): Promise<{ metadata: MetadataStore; admin: ReturnType<typeof setup>["admin"]; check: ReturnType<typeof setup>["check"]; prev: ReturnType<typeof update>; latest: ReturnType<typeof update> }> {
    const s = setup();
    const prev = update();
    const latest = update({ rolloutPercent: 20 });
    await s.metadata.add(prev);
    await s.metadata.add(latest);
    return { ...s, prev, latest };
  }

  it("needs the bearer token", async () => {
    const { admin } = await seeded();
    expect((await admin("GET", "/updates", undefined, "wrong")).status).toBe(401);
    const off = createOtaHandler({ metadata: memoryMetadata(), basePath: "/ota" });
    expect((await off(new Request(`${BASE}/updates`))).status).toBe(404);
  });

  it("changes the rollout percentage", async () => {
    const { admin, metadata, latest } = await seeded();
    expect((await admin("POST", `/updates/${latest.id}/rollout`, { percent: 100 })).status).toBe(200);
    expect((await metadata.get(latest.id))!.rolloutPercent).toBe(100);
    expect((await admin("POST", `/updates/${latest.id}/rollout`, { percent: 101 })).status).toBe(400);
    expect((await admin("POST", `/updates/nope/rollout`, { percent: 5 })).status).toBe(404);
  });

  it("pauses a channel so every device gets the previous update, and reports the current one", async () => {
    const { admin, check, prev, latest } = await seeded();
    await admin("POST", `/updates/${latest.id}/rollout`, { percent: 100 });
    const res = await admin("POST", "/channels/production/pause");
    expect((await res.json()).paused.map((r: { id: string }) => r.id)).toEqual([latest.id]);
    expect(JSON.parse((await parts(await check())).manifest!.body).id).toBe(prev.id);
    const current = await (await admin("GET", "/current?channel=production")).json();
    expect(current.ios.id).toBe(prev.id);
    expect(current.android).toBeNull();
    await admin("POST", `/updates/${latest.id}/resume`);
    expect(JSON.parse((await parts(await check())).manifest!.body).id).toBe(latest.id);
  });

  it("rolls a channel back to the embedded update", async () => {
    const { admin, check } = await seeded();
    expect((await admin("POST", "/channels/production/rollback", { platform: "ios" })).status).toBe(200);
    expect(JSON.parse((await parts(await check({ "expo-current-update-id": "x" }))).directive!.body).type).toBe("rollBackToEmbedded");
    expect((await check({ "expo-platform": "android" })).status).toBe(204);
  });

  it("lists updates newest first", async () => {
    const { admin, prev, latest } = await seeded();
    const list = await (await admin("GET", "/updates?channel=production")).json();
    expect(list.map((r: { id: string }) => r.id)).toEqual([latest.id, prev.id]);
  });
});
