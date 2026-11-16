import { createHash, createSign, randomUUID } from "node:crypto";
import type { OtaRecord, StoredAsset } from "./types";

/** Expo Updates protocol v1 pieces: https://docs.expo.dev/technical-specs/expo-updates-1/ */

export type ManifestAsset = { hash: string; key: string; contentType: string; fileExtension?: string; url: string };
export type Manifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: ManifestAsset;
  assets: ManifestAsset[];
  metadata: Record<string, string>;
  extra: Record<string, unknown>;
};
export type Directive = { type: "noUpdateAvailable" } | { type: "rollBackToEmbedded"; parameters: { commitTime: string } };

/** Builds the manifest JSON for a stored update. `assetUrl` turns a storage key into a download URL. */
export function buildManifest(record: OtaRecord, assetUrl: (storageKey: string) => string): Manifest {
  if (record.kind !== "update" || !record.body) throw new Error(`${record.id} is not an update`);
  const toAsset = (a: StoredAsset, launch = false): ManifestAsset => ({
    hash: a.hash,
    key: a.key,
    contentType: a.contentType,
    // The spec says the launch asset's fileExtension is ignored and SHOULD be omitted.
    ...(!launch && a.fileExtension ? { fileExtension: a.fileExtension } : {}),
    url: assetUrl(a.storageKey),
  });
  return {
    id: record.id,
    createdAt: record.createdAt,
    runtimeVersion: record.runtimeVersion,
    launchAsset: toAsset(record.body.launchAsset, true),
    assets: record.body.assets.map((a) => toAsset(a)),
    metadata: record.body.metadata ?? {},
    extra: record.body.extra ?? {},
  };
}

/** RSA-SHA256 (PKCS#1 v1.5) over the exact part body, as expo-updates verifies it. Returns the `expo-signature` value. */
export function signBody(body: string, privateKeyPem: string, keyId = "main"): string {
  const sig = createSign("RSA-SHA256").update(body, "utf8").sign(privateKeyPem, "base64");
  return `sig="${sig}", keyid="${sfvString(keyId)}", alg="rsa-v1_5-sha256"`;
}

/** Escapes an SFV string's contents. */
export const sfvString = (s: string) => s.replace(/[\\"]/g, (c) => `\\${c}`);

/** Serialises a flat SFV dictionary of strings (for expo-manifest-filters / expo-server-defined-headers). */
export const sfvDictionary = (d: Record<string, string>) =>
  Object.entries(d)
    .map(([k, v]) => `${k}="${sfvString(v)}"`)
    .join(", ");

/** Base64URL SHA-256, the asset hash the client checks. */
export const assetHash = (data: Uint8Array) => createHash("sha256").update(data).digest("base64url");
export const md5Hex = (data: Uint8Array) => createHash("md5").update(data).digest("hex");

export type Part = { name: "manifest" | "directive" | "extensions"; json: string; signature?: string };

/** A multipart/mixed body with the given parts. */
export function multipart(parts: Part[], boundary = `ota-${randomUUID()}`) {
  const chunks = parts.map((p) => {
    const head = [`content-disposition: form-data; name="${p.name}"`, `content-type: application/json; charset=utf-8`];
    if (p.signature) head.push(`expo-signature: ${p.signature}`);
    return `--${boundary}\r\n${head.join("\r\n")}\r\n\r\n${p.json}\r\n`;
  });
  return { body: `${chunks.join("")}--${boundary}--\r\n`, contentType: `multipart/mixed; boundary=${boundary}` };
}

/** Tiny multipart/mixed reader (tests and the CLI's smoke check). */
export function parseMultipart(body: string, contentType: string): Record<string, { headers: Record<string, string>; body: string }> {
  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1];
  if (!boundary) throw new Error("no boundary");
  const out: Record<string, { headers: Record<string, string>; body: string }> = {};
  for (const raw of body.split(`--${boundary}`).slice(1)) {
    if (raw.startsWith("--")) break;
    const [head, ...rest] = raw.replace(/^\r\n/, "").split("\r\n\r\n");
    const headers = Object.fromEntries(
      head!.split("\r\n").map((l) => {
        const i = l.indexOf(":");
        return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()];
      }),
    );
    const name = /name="([^"]+)"/.exec(headers["content-disposition"] ?? "")?.[1];
    if (name) out[name] = { headers, body: rest.join("\r\n\r\n").replace(/\r\n$/, "") };
  }
  return out;
}
