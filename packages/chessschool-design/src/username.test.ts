import { describe, expect, it } from "vitest";
import { normalizeUsername, suggestUsername, usernameBase, usernameProblem } from "./username";

describe("usernames", () => {
  it("takes up to four letters of the first name, folded to ASCII", () => {
    expect(usernameBase("Asha Rao")).toBe("asha");
    expect(usernameBase("Ánñe-Marie")).toBe("anne");
    expect(usernameBase("Bo")).toBe("bo");
    expect(usernameBase("J")).toBe("chess");
    expect(usernameBase("आशा")).toBe("chess");
    expect(usernameBase("")).toBe("chess");
    expect(usernameBase("Shit")).toBe("chess");
  });

  it("adds four digits", () => {
    expect(suggestUsername("Asha", () => 0.4821)).toBe("asha4821");
    expect(suggestUsername("Asha", () => 0.0007)).toBe("asha0007");
    expect(usernameProblem(suggestUsername("Zoë"))).toBeNull();
  });

  it("checks length, characters, reserved words and rude words", () => {
    expect(usernameProblem("ab")).toBe("length");
    expect(usernameProblem("a".repeat(21))).toBe("length");
    expect(usernameProblem("asha rao")).toBe("chars");
    expect(usernameProblem("_asha")).toBe("chars");
    expect(usernameProblem("asha.")).toBe("chars");
    expect(usernameProblem("as..ha")).toBe("chars");
    expect(usernameProblem("admin")).toBe("reserved");
    expect(usernameProblem("the_chessschool")).toBe("reserved");
    expect(usernameProblem("fuck_you")).toBe("rude");
    expect(usernameProblem("shit4821")).toBe("rude");
    expect(usernameProblem("Asha_R.2010")).toBeNull();
    expect(normalizeUsername(" @Asha4821 ")).toBe("asha4821");
  });
});
