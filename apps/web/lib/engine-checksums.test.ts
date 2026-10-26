import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const engineDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/engine",
);

/** Pinned digests of the shipped stockfish.js 18.0.0 lite files. */
const EXPECTED_SHA256 = {
  "stockfish-18-lite-single.js":
    "2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe",
  "stockfish-18-lite-single.wasm":
    "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
} as const;

function sha256(filename: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(engineDir, filename)))
    .digest("hex");
}

describe("shipped Stockfish engine checksums", () => {
  it("hashes the js and wasm files to the pinned stockfish.js 18.0.0 digests", () => {
    expect(sha256("stockfish-18-lite-single.js")).toBe(
      EXPECTED_SHA256["stockfish-18-lite-single.js"],
    );
    expect(sha256("stockfish-18-lite-single.wasm")).toBe(
      EXPECTED_SHA256["stockfish-18-lite-single.wasm"],
    );
  });

  it("publishes those digests in checksums.json and VERSION.txt", () => {
    const published = JSON.parse(
      readFileSync(path.join(engineDir, "checksums.json"), "utf8"),
    ) as {
      files: Record<string, string>;
      commit: string;
    };
    expect(published.commit).toBe("31a98753a5d932511693f44775da908377c24513");
    expect(published.files).toEqual(EXPECTED_SHA256);

    const version = readFileSync(path.join(engineDir, "VERSION.txt"), "utf8");
    expect(version).toContain("31a98753a5d932511693f44775da908377c24513");
    expect(version).toContain(
      "https://github.com/nmrugg/stockfish.js/tree/31a98753a5d932511693f44775da908377c24513",
    );
    expect(version).toContain("cb3d4ee9b47d0c5aae855b12379378ea1439675c");
    expect(version).toContain(EXPECTED_SHA256["stockfish-18-lite-single.js"]);
    expect(version).toContain(EXPECTED_SHA256["stockfish-18-lite-single.wasm"]);
  });
});
