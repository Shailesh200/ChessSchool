import { describe, expect, it } from "vitest";
import {
  APP_REPOSITORY_URL,
  STOCKFISH_JS_COMMIT,
  STOCKFISH_JS_SOURCE_URL,
  STOCKFISH_NOTICE,
  STOCKFISH_UPSTREAM_COMMIT,
  STOCKFISH_UPSTREAM_URL,
  appSourceUrl,
  webBuildRevision,
} from "./licences";

describe("web Stockfish licence notice", () => {
  it("links the shipped stockfish.js commit and keeps official Stockfish as the origin", () => {
    expect(STOCKFISH_NOTICE).toBe("Uses Stockfish, licensed under GPL-3.0");
    expect(STOCKFISH_JS_COMMIT).toBe("31a98753a5d932511693f44775da908377c24513");
    expect(STOCKFISH_JS_SOURCE_URL).toBe(
      `https://github.com/nmrugg/stockfish.js/tree/${STOCKFISH_JS_COMMIT}`,
    );
    expect(STOCKFISH_UPSTREAM_COMMIT).toBe("cb3d4ee9b47d0c5aae855b12379378ea1439675c");
    expect(STOCKFISH_UPSTREAM_URL).toBe(
      `https://github.com/official-stockfish/Stockfish/tree/${STOCKFISH_UPSTREAM_COMMIT}`,
    );
  });

  it("uses VERCEL_GIT_COMMIT_SHA and otherwise the repository root", () => {
    const sha = "cb3d4ee9b47d0c5aae855b12379378ea1439675c";
    expect(webBuildRevision({ vercelSha: sha })).toBe(sha);
    expect(webBuildRevision({ vercelSha: sha.toUpperCase() })).toBe(sha);
    expect(webBuildRevision({ vercelSha: "sf_18" })).toBeNull();
    expect(webBuildRevision({ vercelSha: "abc1234" })).toBeNull();
    expect(webBuildRevision({ vercelSha: "" })).toBeNull();
    expect(appSourceUrl(sha)).toBe(`${APP_REPOSITORY_URL}/tree/${sha}`);
    expect(appSourceUrl(null)).toBe(APP_REPOSITORY_URL);
    expect(appSourceUrl("v18.0.0")).toBe(APP_REPOSITORY_URL);
  });
});
