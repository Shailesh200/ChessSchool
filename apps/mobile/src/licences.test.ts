import { describe, expect, it } from "vitest";
import { GPL_3_TEXT } from "./gpl-3.0-text";
import {
  APP_REPOSITORY_URL,
  STOCKFISH_COMMIT,
  STOCKFISH_NOTICE,
  STOCKFISH_SOURCE_URL,
  appSourceUrl,
  licenceScreenModel,
} from "./licences";

describe("About & licences screen", () => {
  it("shows the Stockfish GPL notice, author credit, and exact source", () => {
    const model = licenceScreenModel({ version: "0.2.0" });
    expect(model.title).toBe("About & licences");
    expect(model.notice).toBe("Uses Stockfish, licensed under GPL-3.0");
    expect(model.notice).toBe(STOCKFISH_NOTICE);
    expect(model.credit).toContain("Tord Romstad");
    expect(model.credit).toContain("Marco Costalba");
    expect(model.credit).toContain("Joona Kiiski");
    expect(model.credit).toContain("Gary Linscott");
    expect(model.stockfishSourceUrl).toBe(STOCKFISH_SOURCE_URL);
    expect(model.stockfishSourceUrl).toBe(
      `https://github.com/official-stockfish/Stockfish/tree/${STOCKFISH_COMMIT}`,
    );
    expect(model.versionLabel).toBe("ChessSchool v0.2.0");
  });

  it("links this build to its commit or tag", () => {
    const sha = "cb3d4ee9b47d0c5aae855b12379378ea1439675c";
    expect(licenceScreenModel({ gitCommit: sha }).appSourceUrl).toBe(
      `https://github.com/Shailesh200/ChessSchool/tree/${sha}`,
    );
    expect(licenceScreenModel({ gitTag: "sf_18" }).appSourceUrl).toBe(
      "https://github.com/Shailesh200/ChessSchool/tree/sf_18",
    );
    expect(licenceScreenModel({ envCommit: "abc1234" }).appSourceUrl).toBe(
      "https://github.com/Shailesh200/ChessSchool/tree/abc1234",
    );
  });

  it("prefers the Expo config commit over a tag or env value", () => {
    const model = licenceScreenModel({
      gitCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      gitTag: "v1.2.3",
      envCommit: "bbbbbbb",
    });
    expect(model.appSourceKnown).toBe(true);
    expect(model.appSourceUrl).toContain("/tree/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("falls back to the repository root when the build ref is unknown", () => {
    expect(licenceScreenModel().appSourceUrl).toBe(APP_REPOSITORY_URL);
    expect(licenceScreenModel().appSourceKnown).toBe(false);
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
