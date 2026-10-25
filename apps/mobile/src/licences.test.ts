import { describe, expect, it } from "vitest";
import { GPL_3_TEXT } from "./gpl-3.0-text";
import {
  APP_REPOSITORY_URL,
  STOCKFISH_JS_COMMIT,
  STOCKFISH_JS_SOURCE_URL,
  STOCKFISH_NOTICE,
  STOCKFISH_UPSTREAM_COMMIT,
  STOCKFISH_UPSTREAM_URL,
  appSourceUrl,
  licenceScreenModel,
} from "./licences";

describe("About & licences screen", () => {
  it("credits Stockfish and links the shipped stockfish.js commit, with upstream as origin", () => {
    const model = licenceScreenModel({ version: "0.2.0" });
    expect(model.title).toBe("About & licences");
    expect(model.notice).toBe("Uses Stockfish, licensed under GPL-3.0");
    expect(model.notice).toBe(STOCKFISH_NOTICE);
    expect(model.credit).toContain("Tord Romstad");
    expect(model.credit).toContain("Marco Costalba");
    expect(model.credit).toContain("Joona Kiiski");
    expect(model.credit).toContain("Gary Linscott");
    expect(model.shippedSourceUrl).toBe(STOCKFISH_JS_SOURCE_URL);
    expect(model.shippedSourceUrl).toBe(
      `https://github.com/nmrugg/stockfish.js/tree/${STOCKFISH_JS_COMMIT}`,
    );
    expect(STOCKFISH_JS_COMMIT).toBe("31a98753a5d932511693f44775da908377c24513");
    expect(model.upstreamSourceUrl).toBe(STOCKFISH_UPSTREAM_URL);
    expect(model.upstreamSourceUrl).toBe(
      `https://github.com/official-stockfish/Stockfish/tree/${STOCKFISH_UPSTREAM_COMMIT}`,
    );
    expect(model.versionLabel).toBe("ChessSchool v0.2.0");
  });

  it("links this build to a full commit SHA", () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(licenceScreenModel({ gitCommit: sha }).appSourceUrl).toBe(
      `https://github.com/Shailesh200/ChessSchool/tree/${sha}`,
    );
    expect(licenceScreenModel({ gitCommit: sha.toUpperCase() }).appSourceUrl).toBe(
      `${APP_REPOSITORY_URL}/tree/${sha}`,
    );
    expect(licenceScreenModel({ gitCommit: sha }).appSourceKnown).toBe(true);
  });

  it("falls back to the repository root for tags, short SHAs, and a missing commit", () => {
    expect(licenceScreenModel().appSourceUrl).toBe(APP_REPOSITORY_URL);
    expect(licenceScreenModel().appSourceKnown).toBe(false);
    expect(licenceScreenModel({ gitCommit: "sf_18" }).appSourceUrl).toBe(APP_REPOSITORY_URL);
    expect(licenceScreenModel({ gitCommit: "v18.0.0" }).appSourceUrl).toBe(APP_REPOSITORY_URL);
    expect(appSourceUrl("abc1234")).toBe(APP_REPOSITORY_URL);
    expect(appSourceUrl("")).toBe(APP_REPOSITORY_URL);
    expect(appSourceUrl("..")).toBe(APP_REPOSITORY_URL);
    expect(appSourceUrl("../secrets")).toBe(APP_REPOSITORY_URL);
    expect(appSourceUrl("https://evil.example")).toBe(APP_REPOSITORY_URL);
    expect(appSourceUrl(undefined)).toBe(APP_REPOSITORY_URL);
  });

  it("bundles the GPL-3.0 text", () => {
    expect(GPL_3_TEXT).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(GPL_3_TEXT).toContain("Version 3, 29 June 2007");
    expect(GPL_3_TEXT).toContain("END OF TERMS AND CONDITIONS");
    expect(GPL_3_TEXT.length).toBeGreaterThan(30_000);
  });
});
