import { describe, expect, it } from "vitest";
import {
  APP_REPOSITORY_URL,
  STOCKFISH_COMMIT,
  STOCKFISH_JS_RELEASE_URL,
  STOCKFISH_NOTICE,
  STOCKFISH_SOURCE_URL,
  appSourceUrl,
  webBuildRevision,
} from "./licences";

describe("web Stockfish licence notice", () => {
  it("names GPL-3.0 and the exact Stockfish 18 commit", () => {
    expect(STOCKFISH_NOTICE).toBe("Uses Stockfish, licensed under GPL-3.0");
    expect(STOCKFISH_SOURCE_URL).toBe(
      `https://github.com/official-stockfish/Stockfish/tree/${STOCKFISH_COMMIT}`,
    );
    expect(STOCKFISH_COMMIT).toBe("cb3d4ee9b47d0c5aae855b12379378ea1439675c");
    expect(STOCKFISH_JS_RELEASE_URL).toBe(
      "https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0",
    );
  });

  it("uses the Vercel or GitHub commit and otherwise the repository root", () => {
    const sha = "cb3d4ee9b47d0c5aae855b12379378ea1439675c";
    expect(webBuildRevision({ vercelSha: sha, githubSha: "ignored" })).toBe(sha);
    expect(webBuildRevision({ githubSha: "abc1234" })).toBe("abc1234");
    expect(webBuildRevision({ vercelSha: "../nope", githubSha: "" })).toBeNull();
    expect(appSourceUrl(sha)).toBe(`${APP_REPOSITORY_URL}/tree/${sha}`);
    expect(appSourceUrl(null)).toBe(APP_REPOSITORY_URL);
    expect(appSourceUrl("not a ref")).toBe(APP_REPOSITORY_URL);
  });
});
