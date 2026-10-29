import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  RETIRED_PLAY_ASSETS,
  assertNoRetiredPlayAssets,
  assertPlayStoreAssets,
  readPngSize,
} from "./generate-play-store-assets.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const playStore = join(here, "../apps/mobile/store-assets/play-store");

function fakePng(width, height) {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe("play store asset guard", () => {
  it("reads PNG dimensions and rejects a non-png", () => {
    assert.deepEqual(readPngSize(fakePng(512, 512)), { width: 512, height: 512 });
    assert.throws(() => readPngSize(Buffer.from("not a png")), /not a PNG/);
  });

  it("refuses a retired asset name and accepts an empty list", () => {
    assert.doesNotThrow(() => assertNoRetiredPlayAssets([]));
    assert.throws(
      () => assertNoRetiredPlayAssets(["screenshots/04-play.png"]),
      /refusing to leave retired asset in place: screenshots\/04-play\.png/,
    );
    assert.ok(RETIRED_PLAY_ASSETS.includes("feature-graphic-1024x500.png"));
  });

  it("requires a 512×512 icon and no retired files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "play-assets-"));
    try {
      await writeFile(join(dir, "icon-512.png"), fakePng(100, 100));
      await assert.rejects(() => assertPlayStoreAssets(dir), /must be 512×512 \(got 100×100\)/);
      await writeFile(join(dir, "icon-512.png"), fakePng(512, 512));
      await assertPlayStoreAssets(dir);
      await mkdir(join(dir, "screenshots"));
      await writeFile(join(dir, "screenshots/01-academy.png"), fakePng(8, 8));
      await assert.rejects(
        () => assertPlayStoreAssets(dir),
        /refusing to leave retired asset in place: screenshots\/01-academy\.png/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("accepts the committed play-store folder", async () => {
    await assertPlayStoreAssets(playStore);
  });
});
