import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The qa-sim Maestro flow taps onboarding avatars by id (avatar-0, avatar-1, …).
const src = readFileSync(join(__dirname, "../app/onboarding.tsx"), "utf8");

describe("onboarding avatar cells", () => {
  it("give each avatar cell a testID of avatar-<index>", () => {
    expect(src).toMatch(
      /AVATAR_OPTIONS\.map\(\(a, i\) => \(\s*<Pressable key=\{a\} testID=\{`avatar-\$\{i\}`\}/,
    );
  });
});
