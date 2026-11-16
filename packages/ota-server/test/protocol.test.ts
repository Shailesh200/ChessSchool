import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildManifest, inRollout, multipart, parseMultipart, rolloutBucket, signBody } from "../src";
import { update } from "./helpers";

describe("manifest", () => {
  it("has the spec's fields and turns storage keys into URLs", () => {
    const r = update();
    const m = buildManifest(r, (k) => `https://cdn.example/${k}`);
    expect(Object.keys(m).sort()).toEqual(["assets", "createdAt", "extra", "id", "launchAsset", "metadata", "runtimeVersion"]);
    expect(m).toMatchObject({ id: r.id, createdAt: r.createdAt, runtimeVersion: "1.0.0", metadata: {}, extra: { expoClient: { name: "Demo" } } });
    expect(m.launchAsset).toEqual({ hash: "bHVuY2g", key: "launchkey", contentType: "application/javascript", url: "https://cdn.example/assets/launch" });
    expect(m.assets[0]).toEqual({ hash: "aW1n", key: "imgkey", contentType: "image/png", fileExtension: ".png", url: "https://cdn.example/assets/img" });
  });

  it("refuses a rollback record", () => {
    expect(() => buildManifest(update({ kind: "rollback", body: null }), (k) => k)).toThrow();
  });
});

describe("signature", () => {
  it.each(["pkcs1", "pkcs8"] as const)("is RSA-SHA256 over the part body (%s key)", (type) => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type, format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const body = JSON.stringify({ hello: "world" });
    const header = signBody(body, privateKey, "main");
    const sig = /sig="([^"]+)"/.exec(header)![1]!;
    expect(header).toContain('keyid="main"');
    expect(header).toContain('alg="rsa-v1_5-sha256"');
    expect(createVerify("RSA-SHA256").update(body).verify(publicKey, sig, "base64")).toBe(true);
    expect(createVerify("RSA-SHA256").update(body + " ").verify(publicKey, sig, "base64")).toBe(false);
  });
});

describe("multipart", () => {
  it("round-trips named parts with their headers", () => {
    const { body, contentType } = multipart([{ name: "manifest", json: '{"a":1}', signature: 'sig="x"' }, { name: "extensions", json: "{}" }], "b0");
    expect(contentType).toBe("multipart/mixed; boundary=b0");
    const parts = parseMultipart(body, contentType);
    expect(parts.manifest!.body).toBe('{"a":1}');
    expect(parts.manifest!.headers["expo-signature"]).toBe('sig="x"');
    expect(parts.manifest!.headers["content-disposition"]).toBe('form-data; name="manifest"');
    expect(parts.extensions!.body).toBe("{}");
  });
});

describe("rollout hashing", () => {
  const ids = Array.from({ length: 4000 }, (_, i) => `device-${i}`);

  it("is stable for a device", () => {
    expect(rolloutBucket("u1", "device-7")).toBe(rolloutBucket("u1", "device-7"));
  });

  it("includes about the given share of devices", () => {
    const share = ids.filter((id) => inRollout({ id: "u1", rolloutPercent: 10 }, id)).length / ids.length;
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.12);
  });

  it("only adds devices when the percentage goes up", () => {
    const at10 = ids.filter((id) => inRollout({ id: "u1", rolloutPercent: 10 }, id));
    const at50 = new Set(ids.filter((id) => inRollout({ id: "u1", rolloutPercent: 50 }, id)));
    expect(at10.every((id) => at50.has(id))).toBe(true);
  });

  it("leaves out devices without a client id unless fully rolled out, and nobody at 0%", () => {
    expect(inRollout({ id: "u1", rolloutPercent: 99 }, null)).toBe(false);
    expect(inRollout({ id: "u1", rolloutPercent: 100 }, null)).toBe(true);
    expect(inRollout({ id: "u1", rolloutPercent: 0 }, "device-1")).toBe(false);
  });
});
