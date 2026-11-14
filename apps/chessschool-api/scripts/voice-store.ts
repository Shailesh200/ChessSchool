import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Where coach clips live: Cloudflare R2 (S3 API) for serving, plus a local copy of every file so
 * clips never have to be paid for twice. Config comes from R2_* in the environment.
 */
export const CACHE_DIR = process.env.VOICE_CACHE_DIR ?? join(homedir(), "ChessSchool-handoff", "voice-cache");

export const cachePath = (coach: string, key: string) => join(CACHE_DIR, coach, `${key}.mp3`);
export const readCached = (coach: string, key: string) => (existsSync(cachePath(coach, key)) ? readFileSync(cachePath(coach, key)) : null);
export function writeCached(coach: string, key: string, audio: Buffer) {
  mkdirSync(join(CACHE_DIR, coach), { recursive: true });
  writeFileSync(cachePath(coach, key), audio);
}

export function r2() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) return null;
  const client = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
  return {
    /** Uploads one clip and returns its public URL. */
    async put(coach: string, key: string, audio: Buffer) {
      const path = `voice/${coach}/${key}.mp3`;
      await client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: path, Body: audio, ContentType: "audio/mpeg", CacheControl: "public, max-age=31536000, immutable" }));
      return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${path}`;
    },
  };
}
