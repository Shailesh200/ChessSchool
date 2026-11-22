import { afterEach, describe, expect, it } from "vitest";
import { copy } from "./copy";
import { hi } from "./copy.hi";
import { langFor, setLanguage } from "./i18n";

afterEach(() => setLanguage("en"));

describe("i18n", () => {
  it("switches strings in place and back, keeping nested references valid", () => {
    const tabs = copy.tabs;
    const english = tabs.today;
    setLanguage("hi");
    expect(tabs.today).toBe(hi.tabs?.today ?? english);
    setLanguage("en");
    expect(tabs.today).toBe(english);
    expect(copy.tabs).toBe(tabs);
  });

  it("keeps functions working in both languages", () => {
    setLanguage("hi");
    expect(typeof copy.social.games(3, 1)).toBe("string");
  });

  it("picks Hindi only for Hindi locales", () => {
    expect(langFor("hi-IN")).toBe("hi");
    expect(langFor("en-IN")).toBe("en");
    expect(langFor(undefined)).toBe("en");
  });
});
