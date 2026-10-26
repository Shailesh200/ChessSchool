import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COACH_CHARACTERS } from "./characters";

const root = path.resolve(process.cwd(), "../..");

function read(rel: string): string {
  return readFileSync(`${root}/${rel}`, "utf8");
}

/** String literals inside the value of one `key:` object, array, or string. */
function valueLiterals(source: string, from: number): string[] {
  let i = from;
  while (i < source.length && /\s/.test(source[i]!)) i++;
  const opener = source[i];
  if (opener === '"' || opener === "'" || opener === "`") {
    return [readString(source, i).value];
  }
  if (opener !== "{" && opener !== "[") return [];

  const literals: string[] = [];
  const stack: string[] = [opener === "{" ? "}" : "]"];
  i++;
  while (i < source.length && stack.length > 0) {
    const c = source[i]!;
    if (c === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const lit = readString(source, i);
      literals.push(lit.value);
      i = lit.end;
      continue;
    }
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if ((c === "}" || c === "]") && stack[stack.length - 1] === c) stack.pop();
    i++;
  }
  return literals;
}

function readString(source: string, start: number): { value: string; end: number } {
  const quote = source[start]!;
  let value = "";
  let i = start + 1;
  while (i < source.length) {
    const c = source[i]!;
    if (c === "\\") {
      value += c + (source[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (quote === "`" && c === "$" && source[i + 1] === "{") {
      const expr = readTemplateExpr(source, i);
      value += expr.raw;
      i = expr.end;
      continue;
    }
    if (c === quote) return { value, end: i + 1 };
    value += c;
    i++;
  }
  return { value, end: i };
}

function readTemplateExpr(
  source: string,
  braceAt: number,
): { raw: string; end: number } {
  let depth = 0;
  let i = braceAt;
  const start = i;
  while (i < source.length) {
    const c = source[i]!;
    if (c === '"' || c === "'" || c === "`") {
      i = readString(source, i).end;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { raw: source.slice(start, i + 1), end: i + 1 };
    }
    i++;
  }
  return { raw: source.slice(start), end: i };
}

function keyedBlocks(source: string, key: string): string[][] {
  const re = new RegExp(`\\b${key}\\s*:`, "g");
  const blocks: string[][] = [];
  for (const match of source.matchAll(re)) {
    blocks.push(valueLiterals(source, match.index + match[0].length));
  }
  return blocks;
}

function field(source: string, key: string, fieldName: string): string | undefined {
  const re = new RegExp(`\\b${key}\\s*:`, "g");
  for (const match of source.matchAll(re)) {
    const from = match.index + match[0].length;
    let i = from;
    while (i < source.length && /\s/.test(source[i]!)) i++;
    if (source[i] !== "{") continue;
    const slice = source.slice(i, i + 1200);
    const found = new RegExp(`${fieldName}:\\s*"([^"]*)"`).exec(slice);
    if (found) return found[1];
  }
  return undefined;
}

function tierLine(source: string, tier: string): string | undefined {
  const needle = `${tier}: \``;
  const at = source.indexOf(needle);
  if (at < 0) return undefined;
  const start = at + needle.length;
  const end = source.indexOf("`", start);
  return end < 0 ? undefined : source.slice(start, end);
}

const webPersonality = read("apps/web/features/coaching/personality.ts");
const mobilePersonality = read("apps/mobile/src/coaching/personality.ts");
const webBotVoice = read("apps/web/features/coaching/botVoice.ts");
const mobileBotVoice = read("apps/mobile/src/coaching/botVoice.ts");
const webCharacters = read("apps/web/features/coaching/characters.ts");
const mobileCharacters = read("apps/mobile/src/coachCharacters.ts");
const webOnboarding = read("apps/web/components/onboarding/OnboardingWizard.tsx");
const mobileOnboarding = read("apps/mobile/app/onboarding.tsx");

describe("Otto anxious_nerd copy parity", () => {
  it("keeps the id and the Careful Nerd label", () => {
    expect(COACH_CHARACTERS.anxious_nerd.id).toBe("anxious_nerd");
    expect(COACH_CHARACTERS.anxious_nerd.theme).toBe("Careful / Nerd");
    expect(field(webCharacters, "anxious_nerd", "id")).toBe("anxious_nerd");
    expect(field(mobileCharacters, "anxious_nerd", "id")).toBe("anxious_nerd");
    expect(field(webCharacters, "anxious_nerd", "theme")).toBe("Careful / Nerd");
    expect(field(mobileCharacters, "anxious_nerd", "theme")).toBe("Careful / Nerd");
    expect(webOnboarding).toContain(
      '{ value: "anxious_nerd", label: "Otto · Careful Nerd", emoji: "🤓" }',
    );
    expect(mobileOnboarding).toContain(
      '{ value: "anxious_nerd", label: "Otto · Careful Nerd", emoji: "🤓" }',
    );
  });

  it("matches web and mobile persona lines", () => {
    const web = keyedBlocks(webPersonality, "anxious_nerd");
    const mobile = keyedBlocks(mobilePersonality, "anxious_nerd");
    expect(mobile).toEqual(web);
    expect(web.length).toBeGreaterThan(0);
    expect(web.flat()).toContain("Phew. Safe move. Nicely done.");
    expect(web.flat()).toContain("Let's go slowly — ");
  });

  it("matches web and mobile botVoice anxious_nerd tables", () => {
    const web = keyedBlocks(webBotVoice, "anxious_nerd");
    const mobile = keyedBlocks(mobileBotVoice, "anxious_nerd");
    expect(mobile).toEqual(web);
    expect(web.length).toBeGreaterThan(1);
    expect(web.flat()).toContain(
      "${b} mated you. Let's find where your king got exposed.",
    );
  });

  it("matches the shared tier lines Muse approved", () => {
    for (const tier of ["novice", "expert", "master", "elite"] as const) {
      expect(tierLine(mobileBotVoice, tier)).toBe(tierLine(webBotVoice, tier));
    }
    expect(tierLine(webBotVoice, "novice")).toBe("First steps — both miss things.");
    expect(tierLine(webBotVoice, "expert")).toBe(
      "Expert — ${botName} is stronger and notices small mistakes.",
    );
    expect(tierLine(webBotVoice, "master")).toBe(
      "Master — ${botName} is very strong and rarely misses.",
    );
    expect(tierLine(webBotVoice, "elite")).toBe(
      "Elite — ${botName} is the strongest. Take your time.",
    );
  });
});
