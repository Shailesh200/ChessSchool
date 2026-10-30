import { describe, expect, it } from "vitest";
import { readPremiumMapPreviewOverride } from "./mapPreview";

describe("readPremiumMapPreviewOverride", () => {
  it("returns null when param absent", () => {
    expect(readPremiumMapPreviewOverride("")).toBeNull();
  });

  it("accepts design map state keys", () => {
    expect(readPremiumMapPreviewOverride("?premiumMap=offline")).toBe("offline");
    expect(readPremiumMapPreviewOverride("?premiumMap=empty")).toBe("empty");
  });

  it("rejects unknown values", () => {
    expect(readPremiumMapPreviewOverride("?premiumMap=bogus")).toBeNull();
  });
});
